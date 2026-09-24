import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { MAX_OPEN_COUNT, openCases } from '@/server/services/cases'

// Only the case id and how many to open are accepted. Price, result and user come from the server.
const body = z.object({ count: z.number().int().min(1).max(MAX_OPEN_COUNT).default(1) }).default({ count: 1 })

export const POST = route({ auth: 'user', rateLimit: RateLimits.caseOpen, idempotency: 'case_open', restricted: true }, async ({ auth, params, ip, req }) => {
  // Body is optional (older clients send none).
  const raw = await req.json().catch(() => ({}))
  const { count } = body.parse(raw ?? {})
  return openCases(auth.user.id, params.id, count, ip)
})
