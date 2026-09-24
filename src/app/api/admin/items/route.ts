import { z } from 'zod'
import { RARITIES, type Rarity } from '@/lib/types'
import { itemSchema } from '@/server/http/adminSchemas'
import { pagination, route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listItemsAdmin, saveItem } from '@/server/services/admin'

const query = pagination.extend({ q: z.string().trim().max(64).optional(), rarity: z.enum(RARITIES as [Rarity, ...Rarity[]]).optional() })

export const GET = route({ auth: 'admin', query, rateLimit: RateLimits.admin }, async ({ query }) => listItemsAdmin(query))
export const POST = route({ auth: 'admin', body: itemSchema, rateLimit: RateLimits.admin }, async ({ auth, body, ip }) => saveItem(auth.user.id, null, body, ip))
