import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { createPayment } from '@/server/services/payments'

const body = z.object({ amount: z.number().positive().max(1_000_000).multipleOf(0.01), method: z.string().max(32).optional() })

export const POST = route({ auth: 'user', body, rateLimit: RateLimits.payment, idempotency: 'payment_create', restricted: true }, async ({ auth, body, ip }) =>
  createPayment(auth.user.id, body.amount, body.method, ip),
)
