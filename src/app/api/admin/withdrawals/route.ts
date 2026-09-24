import { z } from 'zod'
import { pagination, route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listWithdrawalsAdmin } from '@/server/services/admin'

const query = pagination.extend({ status: z.enum(['pending', 'approved', 'rejected', 'completed']).optional() })

export const GET = route({ auth: 'admin', query, rateLimit: RateLimits.admin }, async ({ query }) => listWithdrawalsAdmin(query))
