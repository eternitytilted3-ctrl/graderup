import { z } from 'zod'
import { route } from '@/server/http/handler'
import { syncPrices } from '@/server/pricing/sync'

const body = z.object({ dryRun: z.boolean().default(false) })

// Superadmin only: price changes affect case economics.
export const POST = route({ auth: 'superadmin', body, rateLimit: { name: 'prices-sync', limit: 6, windowSec: 600 } }, async ({ auth, body }) =>
  syncPrices({ adminId: auth.user.id, dryRun: body.dryRun }),
)
