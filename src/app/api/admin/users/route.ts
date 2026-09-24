import { z } from 'zod'
import { pagination, route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { searchUsers } from '@/server/services/admin'

const query = pagination.extend({ q: z.string().trim().max(64).optional() })

export const GET = route({ auth: 'admin', query, rateLimit: RateLimits.admin }, async ({ query }) => searchUsers(query))
