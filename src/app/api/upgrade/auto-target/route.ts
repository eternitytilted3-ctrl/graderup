import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { autoTarget } from '@/server/services/upgrade'

const query = z.object({ userItemId: z.uuid(), mode: z.enum(['x2', 'x5', 'x10', 'c30', 'c50', 'c75']) })

export const GET = route({ auth: 'user', query, rateLimit: RateLimits.read }, async ({ auth, query }) => autoTarget(auth.user.id, query.userItemId, query.mode))
