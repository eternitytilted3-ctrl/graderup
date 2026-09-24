import { hmacSha256, safeEqual } from '../security/crypto'
import { WebhookSignatureError, type CheckoutSession, type CreateCheckoutInput, type PaymentProvider, type WebhookEvent } from './PaymentProvider'

/**
 * Template adapter for a real payment provider (REST checkout + signed webhooks).
 * TODO before production:
 *  1. Map `createCheckout` to the provider's "create payment/invoice" API.
 *  2. Implement the provider's exact webhook signature scheme in `verifyWebhook`.
 *  3. Map provider statuses to WebhookEvent['status'].
 *  4. Confirm with a lawyer that the provider/merchant category is allowed for this business.
 */
export class RealPaymentProvider implements PaymentProvider {
  readonly id = 'real'
  readonly title = 'Банковская карта'
  constructor(
    private readonly cfg: { apiUrl?: string; apiKey?: string; merchantId?: string; webhookSecret: string },
  ) {}

  private assertConfigured() {
    if (!this.cfg.apiUrl || !this.cfg.apiKey || !this.cfg.merchantId) {
      throw new Error('RealPaymentProvider is not configured (REAL_PAYMENT_API_URL / REAL_PAYMENT_API_KEY / REAL_PAYMENT_MERCHANT_ID)')
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    this.assertConfigured()
    const res = await fetch(`${this.cfg.apiUrl}/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({
        merchant_id: this.cfg.merchantId,
        order_id: input.paymentId,
        amount: input.amount,
        currency: input.currency,
        success_url: input.returnUrl,
        callback_url: input.webhookUrl,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Payment provider error: HTTP ${res.status}`)
    const data = (await res.json()) as { id: string; checkout_url: string }
    return { externalId: String(data.id), checkoutUrl: data.checkout_url }
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
    const sig = headers.get('x-signature') ?? ''
    if (!safeEqual(sig, hmacSha256(this.cfg.webhookSecret, rawBody))) throw new WebhookSignatureError()
    const data = JSON.parse(rawBody) as { id: string; order_id: string; status: string; amount: string; currency: string }
    const statusMap: Record<string, WebhookEvent['status']> = { paid: 'completed', success: 'completed', failed: 'failed', canceled: 'cancelled', expired: 'expired' }
    return { externalId: String(data.id), paymentId: data.order_id, status: statusMap[data.status] ?? 'pending', amount: data.amount, currency: data.currency, raw: data }
  }
}
