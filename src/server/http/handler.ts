import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { z, ZodError, type ZodType } from 'zod'
import { env } from '@/config/env'
import { CSRF_HEADER, getAuthFromRequest, type AuthContext } from '../auth/session'
import { checkRegionRestriction } from '../compliance/restrictions'
import { safeEqual } from '../security/crypto'
import { enforceRateLimit, type RateLimitRule } from '../security/rateLimit'
import { clientIp } from '../security/request'
import { logEvent } from '../services/log'
import { AppError, Errors } from './errors'
import { withIdempotency } from './idempotency'

type AuthLevel = 'none' | 'optional' | 'user' | 'admin' | 'superadmin'

interface RouteOptions<B extends ZodType | undefined, Q extends ZodType | undefined, A extends AuthLevel> {
  auth?: A
  body?: B
  query?: Q
  rateLimit?: RateLimitRule | RateLimitRule[]
  /** Scope name — enables Idempotency-Key replay protection for money-moving endpoints. */
  idempotency?: string
  /** CSRF/Origin checks are on for every mutating method unless disabled (webhooks only). */
  csrf?: boolean
  /** Apply region/age restrictions (game & money endpoints). */
  restricted?: boolean
}

type Ctx<B, Q, A extends AuthLevel> = {
  req: NextRequest
  ip: string
  params: Record<string, string>
  body: B extends ZodType ? z.infer<B> : undefined
  query: Q extends ZodType ? z.infer<Q> : undefined
  auth: A extends 'none' ? null : A extends 'optional' ? AuthContext | null : AuthContext
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function zodDetails(err: ZodError) {
  const fields: Record<string, string> = {}
  for (const issue of err.issues) {
    const k = issue.path.join('.') || '_'
    if (!fields[k]) fields[k] = issue.message
  }
  return { fields }
}

export function errorResponse(err: unknown, req?: NextRequest): NextResponse {
  if (err instanceof AppError) {
    const res = NextResponse.json({ error: { code: err.code, message: err.message, ...(err.details ?? {}) } }, { status: err.status })
    if (err.status === 429 && err.details?.retryAfter) res.headers.set('Retry-After', String(err.details.retryAfter))
    return res
  }
  if (err instanceof ZodError) return errorResponse(Errors.validation(zodDetails(err)))
  // Unknown error: log internally, never leak stack/DB details to the client.
  void logEvent('unhandled_error', {
    level: 'error',
    details: { message: (err as Error)?.message?.slice(0, 500), path: req?.nextUrl.pathname },
  })
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'Внутренняя ошибка сервера. Попробуйте позже.' } }, { status: 500 })
}

function checkOrigin(req: NextRequest) {
  const origin = req.headers.get('origin') ?? req.headers.get('referer')
  if (!origin) throw Errors.csrf()
  let host: string
  try {
    host = new URL(origin).host
  } catch {
    throw Errors.csrf()
  }
  const allowed = new Set([new URL(env().APP_URL).host, req.headers.get('x-forwarded-host'), req.headers.get('host')].filter(Boolean))
  if (!allowed.has(host)) throw Errors.csrf()
}

/**
 * Wraps a route handler with: auth/role checks, CSRF (Origin + double-submit token),
 * rate limiting, zod validation, idempotency and structured error handling.
 * Handlers return plain data (JSON-serialized) or a Response.
 */
export function route<B extends ZodType | undefined = undefined, Q extends ZodType | undefined = undefined, A extends AuthLevel = 'none'>(
  opts: RouteOptions<B, Q, A>,
  handler: (ctx: Ctx<B, Q, A>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      const ip = clientIp(req)
      const authLevel: AuthLevel = opts.auth ?? 'none'
      const mutating = MUTATING.has(req.method)

      if (mutating && opts.csrf !== false) checkOrigin(req)

      const auth = authLevel === 'none' ? null : await getAuthFromRequest(req)
      if (authLevel !== 'none' && authLevel !== 'optional') {
        if (!auth) throw Errors.unauthorized()
        if (authLevel === 'admin' && auth.user.role === 'user') throw Errors.forbidden()
        if (authLevel === 'superadmin' && auth.user.role !== 'superadmin') throw Errors.forbidden()
      }
      if (auth && mutating && opts.csrf !== false) {
        const header = req.headers.get(CSRF_HEADER) ?? ''
        if (!safeEqual(header, auth.csrfToken)) throw Errors.csrf()
      }
      if (opts.restricted) checkRegionRestriction(req, auth?.user ?? null)

      const rules = opts.rateLimit ? (Array.isArray(opts.rateLimit) ? opts.rateLimit : [opts.rateLimit]) : []
      for (const rule of rules) await enforceRateLimit(rule, auth ? `u:${auth.user.id}` : `ip:${ip}`)

      let body: unknown = undefined
      if (opts.body) {
        let raw: unknown
        try {
          raw = await req.json()
        } catch {
          throw Errors.badRequest('Ожидался JSON')
        }
        body = opts.body.parse(raw)
      }
      let query: unknown = undefined
      if (opts.query) query = opts.query.parse(Object.fromEntries(req.nextUrl.searchParams))

      const params = (await context?.params) ?? {}
      const ctx = { req, ip, params, body, query, auth } as Ctx<B, Q, A>

      const run = async () => {
        const result = await handler(ctx)
        return result instanceof Response ? result : NextResponse.json(result ?? { ok: true })
      }

      const idemKey = req.headers.get('idempotency-key')
      if (opts.idempotency && auth && idemKey) {
        return await withIdempotency(auth.user.id, opts.idempotency, idemKey, run)
      }
      return await run()
    } catch (err) {
      return errorResponse(err, req)
    }
  }
}

export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
})
