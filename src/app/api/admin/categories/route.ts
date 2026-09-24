import { categorySchema } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listCategories, saveCategory } from '@/server/services/admin'

export const GET = route({ auth: 'admin', rateLimit: RateLimits.admin }, async () => ({ items: await listCategories() }))
export const POST = route({ auth: 'admin', body: categorySchema, rateLimit: RateLimits.admin }, async ({ auth, body, ip }) => saveCategory(auth.user.id, null, body, ip))
