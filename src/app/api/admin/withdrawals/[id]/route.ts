import { z } from 'zod'
import { uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { processWithdrawal } from '@/server/services/withdrawals'

const body = z.object({ action: z.enum(['approve', 'reject']), note: z.string().trim().max(500).optional() })

export const POST = route({ auth: 'admin', body, rateLimit: RateLimits.admin }, async ({ auth, params, body, ip }) =>
  processWithdrawal(auth.user.id, uuidParam.parse(params.id), body.action, body.note, ip),
)
