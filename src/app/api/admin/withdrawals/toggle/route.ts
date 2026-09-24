import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { setWithdrawEnabled, withdrawConfig } from '@/server/services/withdrawals'

export const GET = route({ auth: 'admin', rateLimit: RateLimits.admin }, async () => withdrawConfig())
export const POST = route({ auth: 'admin', body: z.object({ enabled: z.boolean() }), rateLimit: RateLimits.admin }, async ({ auth, body, ip }) =>
  setWithdrawEnabled(auth.user.id, body.enabled, ip),
)
