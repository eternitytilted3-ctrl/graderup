import { uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { userDetail } from '@/server/services/admin'

export const GET = route({ auth: 'admin', rateLimit: RateLimits.admin }, async ({ params }) => userDetail(uuidParam.parse(params.id)))
