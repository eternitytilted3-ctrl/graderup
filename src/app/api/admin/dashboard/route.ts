import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { dashboard } from '@/server/services/admin'

export const GET = route({ auth: 'admin', rateLimit: RateLimits.admin }, async () => dashboard())
