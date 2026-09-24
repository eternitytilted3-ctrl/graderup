import { caseItemsSchema, uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { setCaseItems } from '@/server/services/admin'

export const PUT = route({ auth: 'admin', body: caseItemsSchema, rateLimit: RateLimits.admin }, async ({ auth, params, body, ip }) =>
  setCaseItems(auth.user.id, uuidParam.parse(params.id), body.items, ip),
)
