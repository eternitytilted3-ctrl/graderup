import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listSkinWithdrawals, requestSkinWithdrawal, skinWithdrawConfig } from '@/server/services/skinWithdrawals'

export const GET = route({ auth: 'user', rateLimit: RateLimits.read }, async ({ auth }) => {
  const [config, items] = await Promise.all([skinWithdrawConfig(), listSkinWithdrawals(auth.user.id)])
  return { config: { enabled: config.available, maxActive: config.maxActive }, items, tradeUrl: auth.user.steamTradeUrl }
})

export const POST = route({ auth: 'user', body: z.object({ userItemId: z.uuid() }), rateLimit: RateLimits.withdraw, idempotency: 'skin_withdraw', restricted: true }, async ({ auth, body, ip }) =>
  requestSkinWithdrawal(auth.user.id, body.userItemId, ip),
)
