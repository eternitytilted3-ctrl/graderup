import { itemSchema, uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { saveItem } from '@/server/services/admin'

export const PUT = route({ auth: 'admin', body: itemSchema, rateLimit: RateLimits.admin }, async ({ auth, params, body, ip }) =>
  saveItem(auth.user.id, uuidParam.parse(params.id), body, ip),
)
