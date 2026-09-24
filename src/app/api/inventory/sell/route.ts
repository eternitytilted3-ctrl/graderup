import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { sellItems } from '@/server/services/inventory'

const body = z.object({ ids: z.array(z.uuid()).min(1).max(200) })

export const POST = route({ auth: 'user', body, rateLimit: RateLimits.sell, idempotency: 'sell_bulk', restricted: true }, async ({ auth, body, ip }) =>
  sellItems(auth.user.id, body.ids, ip),
)
