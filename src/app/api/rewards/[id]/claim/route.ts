import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { claimReward } from '@/server/services/rewards'

export const POST = route({ auth: 'user', rateLimit: RateLimits.claim, idempotency: 'reward_claim', restricted: true }, async ({ auth, params, ip }) =>
  claimReward(auth.user.id, params.id, ip),
)
