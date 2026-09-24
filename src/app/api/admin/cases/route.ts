import { caseSchema } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { saveCase } from '@/server/services/admin'
import { listCases } from '@/server/services/cases'

export const GET = route({ auth: 'admin', rateLimit: RateLimits.admin }, async () => ({ items: await listCases({ includeDisabled: true }) }))
export const POST = route({ auth: 'admin', body: caseSchema, rateLimit: RateLimits.admin }, async ({ auth, body, ip }) => saveCase(auth.user.id, null, body, ip))
