import { z } from 'zod'
import { uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { adjustBalance } from '@/server/services/admin'

const body = z.object({
  amount: z.string().regex(/^-?\d{1,9}(\.\d{1,2})?$/, 'Формат: 10.00 или -5.50'),
  reason: z.string().trim().min(3, 'Укажите причину').max(500),
})

export const POST = route({ auth: 'admin', body, rateLimit: RateLimits.admin, idempotency: 'admin_balance' }, async ({ auth, params, body, ip }) =>
  adjustBalance(auth.user.id, uuidParam.parse(params.id), body.amount, body.reason, ip),
)
