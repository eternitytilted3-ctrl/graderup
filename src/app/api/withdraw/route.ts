import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listWithdrawals, requestWithdrawal, withdrawConfig } from '@/server/services/withdrawals'

const body = z.object({
  amount: z.number().positive().multipleOf(0.01),
  method: z.string().min(1).max(32),
  destination: z.string().trim().min(6, 'Укажите реквизиты').max(128),
})

export const GET = route({ auth: 'user' }, async ({ auth }) => ({
  config: await withdrawConfig(),
  items: await listWithdrawals(auth.user.id),
  kycStatus: auth.user.kycStatus,
}))

export const POST = route({ auth: 'user', body, rateLimit: RateLimits.withdraw, idempotency: 'withdraw', restricted: true }, async ({ auth, body, ip }) =>
  requestWithdrawal(auth.user.id, body, ip),
)
