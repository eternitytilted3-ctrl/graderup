import { z } from 'zod'
import { uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { setRole } from '@/server/services/admin'

const body = z.object({ role: z.enum(['user', 'admin', 'superadmin']) })

// Only superadmins manage roles.
export const POST = route({ auth: 'superadmin', body, rateLimit: RateLimits.admin }, async ({ auth, params, body, ip }) =>
  setRole(auth.user.id, uuidParam.parse(params.id), body.role, ip),
)
