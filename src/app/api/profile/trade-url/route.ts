import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { setTradeUrl } from '@/server/services/skinWithdrawals'

export const PUT = route({ auth: 'user', body: z.object({ tradeUrl: z.string().trim().max(256) }), rateLimit: RateLimits.read }, async ({ auth, body }) => setTradeUrl(auth.user.id, body.tradeUrl))
