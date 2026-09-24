import { z } from 'zod'
import { RARITIES } from '@/lib/types'
import { pagination, route } from '@/server/http/handler'
import { listInventory } from '@/server/services/inventory'

const query = pagination.extend({
  rarity: z.enum(RARITIES as [string, ...string[]]).optional(),
  sort: z.enum(['date_desc', 'date_asc', 'price_desc', 'price_asc', 'rarity_desc', 'rarity_asc']).optional(),
  search: z.string().trim().max(64).optional(),
  minPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
})

export const GET = route({ auth: 'user', query }, async ({ auth, query }) =>
  listInventory(auth.user.id, { ...query, rarity: query.rarity as never }),
)
