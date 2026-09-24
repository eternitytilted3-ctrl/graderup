import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { openCase } from '@/server/services/cases'

// No body is read: price, result and user come exclusively from the server.
export const POST = route({ auth: 'user', rateLimit: RateLimits.caseOpen, idempotency: 'case_open', restricted: true }, async ({ auth, params, ip }) =>
  openCase(auth.user.id, params.id, ip),
)
