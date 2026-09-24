import { z } from 'zod'
import { RARITIES } from '@/lib/types'
import { pagination, route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listUpgradeTargets } from '@/server/services/upgrade'

const query = pagination.extend({
  minPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  search: z.string().trim().max(64).optional(),
  rarity: z.enum(RARITIES as [string, ...string[]]).optional(),
  sort: z.enum(['price_asc', 'price_desc']).optional(),
})

export const GET = route({ query, rateLimit: RateLimits.read }, async ({ query }) => listUpgradeTargets({ ...query, rarity: query.rarity as never }))
