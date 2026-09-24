import { z } from 'zod'
import { uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { setBan } from '@/server/services/admin'

const body = z.object({ banned: z.boolean(), reason: z.string().trim().max(500).optional() })

export const POST = route({ auth: 'admin', body, rateLimit: RateLimits.admin }, async ({ auth, params, body, ip }) =>
  setBan(auth.user.id, uuidParam.parse(params.id), body.banned, body.reason, ip),
)
