import { z } from 'zod'
import { Errors } from '@/server/http/errors'
import { route } from '@/server/http/handler'
import { getPayment } from '@/server/services/payments'

export const GET = route({ auth: 'user' }, async ({ auth, params }) => {
  if (!z.uuid().safeParse(params.id).success) throw Errors.notFound('Платёж не найден')
  return getPayment(auth.user.id, params.id)
})
