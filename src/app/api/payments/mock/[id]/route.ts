import { z } from 'zod'
import { Errors } from '@/server/http/errors'
import { route } from '@/server/http/handler'
import { getMockProvider, mockAllowed } from '@/server/payments'
import { RateLimits } from '@/server/security/rateLimit'
import { getPayment, handleWebhook } from '@/server/services/payments'

/**
 * DEV ONLY — simulates the mock provider's hosted checkout. The provider (server side)
 * signs a webhook, which is then processed by the regular webhook handler.
 * Disabled whenever PAYMENT_PROVIDER != mock or in production without explicit opt-in.
 */
const body = z.object({ outcome: z.enum(['completed', 'failed', 'cancelled']) })

export const POST = route({ auth: 'user', body, rateLimit: RateLimits.payment }, async ({ auth, params, body, ip }) => {
  if (!mockAllowed()) throw Errors.notFound()
  if (!z.uuid().safeParse(params.id).success) throw Errors.notFound('Платёж не найден')
  const p = await getPayment(auth.user.id, params.id)
  if (p.status !== 'pending') return { status: p.status }
  const mock = getMockProvider()
  const hook = mock.buildWebhook({ externalId: `mock_${p.id}`, paymentId: p.id, status: body.outcome, amount: p.amount, currency: p.currency })
  await handleWebhook('mock', hook.body, new Headers({ 'x-mock-signature': hook.signature }), ip)
  return getPayment(auth.user.id, params.id)
})
