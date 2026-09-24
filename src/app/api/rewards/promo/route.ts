import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { redeemPromocode } from '@/server/services/promocodes'

const body = z.object({ code: z.string().trim().min(3).max(32) })

export const POST = route({ auth: 'user', body, rateLimit: RateLimits.promo, idempotency: 'promocode', restricted: true }, async ({ auth, body, ip }) =>
  redeemPromocode(auth.user.id, body.code, ip),
)
