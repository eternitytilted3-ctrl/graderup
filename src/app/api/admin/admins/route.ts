import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { listAdmins } from '@/server/services/admin'

export const GET = route({ auth: 'admin', rateLimit: RateLimits.admin }, async () => ({ items: await listAdmins() }))
