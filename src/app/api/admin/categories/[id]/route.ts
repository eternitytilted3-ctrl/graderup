import { categorySchema, uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { deleteCategory, saveCategory } from '@/server/services/admin'

export const PUT = route({ auth: 'admin', body: categorySchema, rateLimit: RateLimits.admin }, async ({ auth, params, body, ip }) =>
  saveCategory(auth.user.id, uuidParam.parse(params.id), body, ip),
)
export const DELETE = route({ auth: 'admin', rateLimit: RateLimits.admin }, async ({ auth, params, ip }) => deleteCategory(auth.user.id, uuidParam.parse(params.id), ip))
