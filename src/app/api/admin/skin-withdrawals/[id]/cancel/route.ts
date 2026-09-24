import { uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { cancelSkinWithdrawal } from '@/server/services/skinWithdrawals'

export const POST = route({ auth: 'admin', rateLimit: RateLimits.admin }, async ({ auth, params, ip }) => cancelSkinWithdrawal(auth.user.id, uuidParam.parse(params.id), ip))
