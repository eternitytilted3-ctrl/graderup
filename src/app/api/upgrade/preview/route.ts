import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { previewUpgrade } from '@/server/services/upgrade'

const body = z.object({ userItemId: z.uuid(), targetItemId: z.uuid() })

export const POST = route({ auth: 'user', body, rateLimit: RateLimits.read }, async ({ auth, body }) =>
  previewUpgrade(auth.user.id, body.userItemId, body.targetItemId),
)
