import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { AUTO_TARGET_MODE_RE, autoTarget, MAX_UPGRADE_SOURCES } from '@/server/services/upgrade'

const query = z.object({
  userItemIds: z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(z.uuid()).min(1).max(MAX_UPGRADE_SOURCES)),
  mode: z.string().regex(AUTO_TARGET_MODE_RE),
  balanceAmount: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/).optional(),
})

export const GET = route({ auth: 'user', query, rateLimit: RateLimits.read }, async ({ auth, query }) => autoTarget(auth.user.id, query.userItemIds, query.mode, query.balanceAmount))
