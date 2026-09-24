import { z } from 'zod'
import { pagination, route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listPaymentsAdmin } from '@/server/services/admin'

const query = pagination.extend({ status: z.enum(['pending', 'completed', 'failed', 'cancelled', 'expired']).optional() })

export const GET = route({ auth: 'admin', query, rateLimit: RateLimits.admin }, async ({ query }) => listPaymentsAdmin(query))
