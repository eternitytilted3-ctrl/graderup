import { z } from 'zod'
import { Errors } from '@/server/http/errors'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { sellItems } from '@/server/services/inventory'

export const POST = route({ auth: 'user', rateLimit: RateLimits.sell, idempotency: 'sell', restricted: true }, async ({ auth, params, ip }) => {
  if (!z.uuid().safeParse(params.id).success) throw Errors.notFound('Предмет не найден')
  return sellItems(auth.user.id, [params.id], ip)
})
