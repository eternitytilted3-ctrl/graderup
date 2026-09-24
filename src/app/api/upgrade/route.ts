import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { getUpgradeConfigPublic, MAX_UPGRADE_SOURCES, performUpgrade } from '@/server/services/upgrade'

// Only identifiers are accepted. Prices, chance and result are always computed server-side.
const body = z.object({ userItemIds: z.array(z.uuid()).min(1).max(MAX_UPGRADE_SOURCES), targetItemId: z.uuid() })

export const POST = route({ auth: 'user', body, rateLimit: RateLimits.upgrade, idempotency: 'upgrade', restricted: true }, async ({ auth, body, ip }) =>
  performUpgrade(auth.user.id, body.userItemIds, body.targetItemId, ip),
)

export const GET = route({}, async () => getUpgradeConfigPublic())
