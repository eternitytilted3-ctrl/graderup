import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { sellAllItems } from '@/server/services/inventory'

export const POST = route({ auth: 'user', rateLimit: RateLimits.sell, idempotency: 'sell_all', restricted: true }, async ({ auth, ip }) => sellAllItems(auth.user.id, ip))
