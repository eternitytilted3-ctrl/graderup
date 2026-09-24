import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listSkinWithdrawalsAdmin, skinWithdrawConfig } from '@/server/services/skinWithdrawals'

export const GET = route({ auth: 'admin', rateLimit: RateLimits.admin }, async () => ({ config: await skinWithdrawConfig(), items: await listSkinWithdrawalsAdmin() }))
