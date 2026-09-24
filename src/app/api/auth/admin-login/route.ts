import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { users } from '@/server/db/schema'
import { createSession } from '@/server/auth/session'
import { emailProvider } from '@/server/auth/service'
import { loginSchema } from '@/server/auth/validation'
import { AppError } from '@/server/http/errors'
import { applyCookies } from '@/server/http/cookies'
import { route } from '@/server/http/handler'
import { enforceRateLimit, RateLimits } from '@/server/security/rateLimit'
import { userAgent } from '@/server/security/request'
import { logEvent } from '@/server/services/log'

/** Staff sign-in (/cmsadmin). Only admin/superadmin accounts may sign in here; everyone else gets "invalid credentials". */
export const POST = route({ body: loginSchema, rateLimit: RateLimits.login }, async ({ body, ip, req }) => {
  await enforceRateLimit(RateLimits.loginAccount, `acc:${body.login.toLowerCase()}`)
  const invalid = new AppError(401, 'INVALID_CREDENTIALS', 'Неверный логин или пароль')
  try {
    const { userId } = await emailProvider.authenticate(body)
    const [u] = await getDb().select({ role: users.role }).from(users).where(eq(users.id, userId))
    if (!u || u.role === 'user') throw invalid
    const session = await createSession(userId, { ip, userAgent: userAgent(req) })
    void logEvent('admin_login', { level: 'security', userId, ip })
    return applyCookies(NextResponse.json({ ok: true }), session.cookies)
  } catch (err) {
    if (err instanceof AppError) void logEvent('admin_login_failed', { level: 'security', ip, details: { login: body.login.slice(0, 64), code: err.code } })
    throw err instanceof AppError && err.code !== 'ACCOUNT_LOCKED' && err.status !== 429 ? invalid : err
  }
})
