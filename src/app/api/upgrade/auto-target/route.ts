import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { autoTarget, MAX_UPGRADE_SOURCES } from '@/server/services/upgrade'

const query = z.object({
  userItemIds: z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(z.uuid()).min(1).max(MAX_UPGRADE_SOURCES)),
  mode: z.enum(['x2', 'x5', 'x10', 'c30', 'c50', 'c75']),
})

export const GET = route({ auth: 'user', query, rateLimit: RateLimits.read }, async ({ auth, query }) => autoTarget(auth.user.id, query.userItemIds, query.mode))
