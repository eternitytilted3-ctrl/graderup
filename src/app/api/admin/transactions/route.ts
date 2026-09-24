import { z } from 'zod'
import { pagination, route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listTransactionsAdmin } from '@/server/services/admin'

const query = pagination.extend({
  type: z.enum(['deposit', 'withdraw', 'case_open', 'item_sell', 'upgrade', 'bonus', 'refund', 'admin_adjustment']).optional(),
  userId: z.uuid().optional(),
})

export const GET = route({ auth: 'admin', query, rateLimit: RateLimits.admin }, async ({ query }) => listTransactionsAdmin(query))
