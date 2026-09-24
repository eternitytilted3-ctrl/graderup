import { D } from '@/lib/money'
import { WebhookSignatureError, type CheckoutSession, type CreateCheckoutInput, type PaymentProvider, type WebhookEvent } from './PaymentProvider'

/**
 * xRocket Pay (RocketX, Telegram crypto wallet) — crypto invoices.
 * Create: POST {apiUrl}/tg-invoices (header Rocket-Pay-Key) with amount in crypto; payload = "<paymentId>:<coins>".
 * Webhook body is NOT trusted: on every notification we re-read the invoice from the xRocket API with our key
 * (server-to-server) and credit only if it is `paid` and belongs to this merchant — no signature scheme needed.
 * Set the webhook URL in @xRocket → Rocket Pay → Webhooks: {APP_URL}/api/payments/webhook/xrocket.
 */
export class XRocketPaymentProvider implements PaymentProvider {
  readonly id = 'xrocket'
  readonly title = 'Криптовалюта (xRocket)'
  readonly hint: string

  constructor(private readonly cfg: { apiKey: string; apiUrl: string; currency: string; coinsPerUnit: number }) {
    this.hint = `${cfg.currency} через Telegram-кошелёк xRocket`
  }

  private async call<T>(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.cfg.apiUrl}/${path}`, {
      ...init,
      headers: { 'Rocket-Pay-Key': this.cfg.apiKey, 'content-type': 'application/json', accept: 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T }
    if (!res.ok || !data.success || !data.data) throw new Error(`xRocket ${path}: HTTP ${res.status}`)
    return data.data
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const cryptoAmount = D(input.amount).div(this.cfg.coinsPerUnit).toDecimalPlaces(2, 0 /* ROUND_UP */).toNumber()
    const inv = await this.call<{ id: number; link: string }>('tg-invoices', {
      method: 'POST',
      body: JSON.stringify({
        amount: cryptoAmount,
        numPayments: 1,
        currency: this.cfg.currency,
        description: `Пополнение GraderUP на ${input.amount} C`,
        payload: `${input.paymentId}:${input.amount}`,
        callbackUrl: input.returnUrl,
        expiredIn: 3600,
      }),
    })
    return { externalId: String(inv.id), checkoutUrl: inv.link }
  }

  async verifyWebhook(rawBody: string): Promise<WebhookEvent> {
    let invoiceId: string
    try {
      const body = JSON.parse(rawBody) as { data?: { id?: number | string } }
      invoiceId = String(body.data?.id ?? '')
    } catch {
      throw new WebhookSignatureError()
    }
    if (!/^\d+$/.test(invoiceId)) throw new WebhookSignatureError()
    // Authoritative state straight from xRocket.
    const inv = await this.call<{ id: number; status: string; payload?: string; currency: string }>(`tg-invoices/${invoiceId}`).catch(() => {
      throw new WebhookSignatureError()
    })
    const [paymentId, coins] = String(inv.payload ?? '').split(':')
    if (!paymentId || !coins) throw new WebhookSignatureError()
    return {
      externalId: String(inv.id),
      paymentId,
      status: inv.status === 'paid' ? 'completed' : inv.status === 'expired' ? 'expired' : 'pending',
      amount: coins,
      currency: 'RUB',
      raw: inv,
    }
  }
}
