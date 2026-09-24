import { z } from 'zod'
import { pagination, route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listLogs } from '@/server/services/admin'

const query = pagination.extend({
  kind: z.enum(['admin', 'events']).default('events'),
  level: z.enum(['info', 'warn', 'error', 'security']).optional(),
  q: z.string().trim().max(64).optional(),
})

export const GET = route({ auth: 'admin', query, rateLimit: RateLimits.admin }, async ({ query }) => listLogs(query))
