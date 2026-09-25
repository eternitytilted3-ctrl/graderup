import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { MAX_UPGRADE_SOURCES, previewUpgrade } from '@/server/services/upgrade'

const body = z.object({ userItemIds: z.array(z.uuid()).min(1).max(MAX_UPGRADE_SOURCES), targetItemId: z.uuid(), balanceAmount: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/).optional() })

export const POST = route({ auth: 'user', body, rateLimit: RateLimits.read }, async ({ auth, body }) => previewUpgrade(auth.user.id, body.userItemIds, body.targetItemId, body.balanceAmount))
