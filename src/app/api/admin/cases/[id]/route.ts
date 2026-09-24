import { caseSchema, uuidParam } from '@/server/http/adminSchemas'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { caseForEdit, saveCase } from '@/server/services/admin'

export const GET = route({ auth: 'admin', rateLimit: RateLimits.admin }, async ({ params }) => caseForEdit(uuidParam.parse(params.id)))
export const PUT = route({ auth: 'admin', body: caseSchema, rateLimit: RateLimits.admin }, async ({ auth, params, body, ip }) =>
  saveCase(auth.user.id, uuidParam.parse(params.id), body, ip),
)
