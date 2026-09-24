import { z } from 'zod'
import { pagination, route } from '@/server/http/handler'
import { getHistory, HISTORY_FILTERS, type HistoryFilter } from '@/server/services/profile'

const query = pagination.extend({
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(Object.keys(HISTORY_FILTERS) as [HistoryFilter, ...HistoryFilter[]]).default('all'),
})

export const GET = route({ auth: 'user', query }, async ({ auth, query }) => getHistory(auth.user.id, query))
