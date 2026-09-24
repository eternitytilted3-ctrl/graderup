import { promocodeSchema } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listPromocodesAdmin, savePromocode } from '@/server/services/admin'

export const GET = route({ auth: 'admin', rateLimit: RateLimits.admin }, async () => ({ items: await listPromocodesAdmin() }))
export const POST = route({ auth: 'admin', body: promocodeSchema, rateLimit: RateLimits.admin }, async ({ auth, body, ip }) =>
  savePromocode(auth.user.id, null, body, ip),
)
