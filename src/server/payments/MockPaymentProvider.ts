import { hmacSha256, safeEqual } from '../security/crypto'
import { WebhookSignatureError, type CheckoutSession, type CreateCheckoutInput, type PaymentProvider, type WebhookEvent } from './PaymentProvider'

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature'

/**
 * Development/test provider. Its "hosted checkout" is /deposit/checkout/:id inside this app.
 * The simulated provider sends an HMAC-signed webhook that goes through exactly the same
 * verification + crediting path as a real provider would.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock'
  readonly title = 'Тестовая оплата'
  readonly hint = 'Только для разработки'
  constructor(
    private readonly secret: string,
    private readonly appUrl: string,
  ) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    return { externalId: `mock_${input.paymentId}`, checkoutUrl: `${this.appUrl}/deposit/checkout/${input.paymentId}` }
  }

  sign(body: string) {
    return hmacSha256(this.secret, body)
  }

  /** Builds the webhook the simulated provider would send. */
  buildWebhook(event: { externalId: string; paymentId: string; status: WebhookEvent['status']; amount: string; currency: string }) {
    const body = JSON.stringify({ ...event, ts: Date.now() })
    return { body, signature: this.sign(body) }
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
    const sig = headers.get(MOCK_SIGNATURE_HEADER) ?? ''
    if (!safeEqual(sig, this.sign(rawBody))) throw new WebhookSignatureError()
    const data = JSON.parse(rawBody) as { externalId: string; paymentId: string; status: WebhookEvent['status']; amount: string; currency: string; ts: number }
    // Replay window: reject webhooks older than 10 minutes.
    if (!data.ts || Math.abs(Date.now() - data.ts) > 10 * 60_000) throw new WebhookSignatureError()
    return { externalId: data.externalId, paymentId: data.paymentId, status: data.status, amount: data.amount, currency: data.currency, raw: data }
  }
}
