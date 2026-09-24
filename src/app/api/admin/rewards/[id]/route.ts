import { rewardSchema, uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { updateReward } from '@/server/services/admin'

export const PUT = route({ auth: 'admin', body: rewardSchema, rateLimit: RateLimits.admin }, async ({ auth, params, body, ip }) =>
  updateReward(auth.user.id, uuidParam.parse(params.id), body, ip),
)
