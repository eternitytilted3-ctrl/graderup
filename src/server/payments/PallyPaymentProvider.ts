import { createHash } from 'node:crypto'
import { safeEqual } from '../security/crypto'
import { WebhookSignatureError, type CheckoutSession, type CreateCheckoutInput, type PaymentProvider, type WebhookEvent } from './PaymentProvider'

/**
 * Pally (pally.info / pal24.pro) — cards & SBP.
 * Create bill: POST {apiUrl}/bill/create (Bearer token) → link_page_url.
 * Result URL (postback, form-encoded): InvId (= our order_id), OutSum, Status, SignatureValue,
 * where SignatureValue = strtoupper(md5(OutSum + ":" + InvId + ":" + apiToken)).
 * Configure in the Pally shop: Result URL = {APP_URL}/api/payments/webhook/pally.
 * ⚠️ Verify field names against the current Pally docs before going live.
 */
export class PallyPaymentProvider implements PaymentProvider {
  readonly id = 'pally'
  readonly title = 'Карта / СБП (Pally)'
  readonly hint = 'Visa, Mastercard, МИР, СБП'
  readonly webhookAck = 'OK'

  constructor(private readonly cfg: { apiToken: string; shopId: string; apiUrl: string }) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const body = new URLSearchParams({
      amount: input.amount,
      order_id: input.paymentId,
      description: `Пополнение баланса GraderUP`,
      type: 'normal',
      shop_id: this.cfg.shopId,
      currency_in: 'RUB',
      custom: input.paymentId,
      name: 'GraderUP',
      success_url: input.returnUrl,
      fail_url: input.returnUrl,
    })
    const res = await fetch(`${this.cfg.apiUrl}/bill/create`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.cfg.apiToken}`, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(15_000),
    })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean | string; link_page_url?: string; link_url?: string; bill_id?: string }
    if (!res.ok || !(data.link_page_url || data.link_url)) throw new Error(`Pally bill/create failed: HTTP ${res.status}`)
    return { externalId: String(data.bill_id ?? input.paymentId), checkoutUrl: (data.link_page_url ?? data.link_url)! }
  }

  sign(outSum: string, invId: string) {
    return createHash('md5').update(`${outSum}:${invId}:${this.cfg.apiToken}`).digest('hex').toUpperCase()
  }

  async verifyWebhook(rawBody: string): Promise<WebhookEvent> {
    const q = new URLSearchParams(rawBody)
    const outSum = q.get('OutSum') ?? ''
    const invId = q.get('InvId') ?? ''
    const sig = (q.get('SignatureValue') ?? '').toUpperCase()
    if (!outSum || !invId || !safeEqual(sig, this.sign(outSum, invId))) throw new WebhookSignatureError()
    const status = (q.get('Status') ?? '').toUpperCase()
    return {
      externalId: q.get('TrsId') ?? invId,
      paymentId: invId,
      status: status === 'SUCCESS' || status === 'OVERPAID' ? 'completed' : status === 'FAIL' ? 'failed' : 'pending',
      amount: outSum,
      currency: q.get('CurrencyIn') ?? 'RUB',
      raw: Object.fromEntries(q),
    }
  }
}
