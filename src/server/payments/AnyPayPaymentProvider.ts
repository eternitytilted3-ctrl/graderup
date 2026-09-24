import { createHash } from 'node:crypto'
import { safeEqual } from '../security/crypto'
import { WebhookSignatureError, type CheckoutSession, type CreateCheckoutInput, type PaymentProvider, type WebhookEvent } from './PaymentProvider'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/**
 * AnyPay (anypay.io) — payment form (SCI).
 * Form: https://anypay.io/merchant?merchant_id&pay_id&amount&currency&desc&success_url&fail_url&sign,
 *   sign = sha256("merchant_id:pay_id:amount:currency:desc:success_url:fail_url:secret_key").
 * Notification (form POST): merchant_id, pay_id, amount, currency, status, …, sign,
 *   sign = sha256("currency:amount:pay_id:merchant_id:status:secret_key"). Must answer "OK".
 * Optional: restrict notifications to AnyPay IPs via ANYPAY_ALLOWED_IPS.
 * Configure in the AnyPay project: Notification URL = {APP_URL}/api/payments/webhook/anypay.
 * ⚠️ Verify the signature formulas against the current AnyPay docs before going live.
 */
export class AnyPayPaymentProvider implements PaymentProvider {
  readonly id = 'anypay'
  readonly title = 'AnyPay'
  readonly hint = 'Карты, СБП, кошельки'
  readonly webhookAck = 'OK'

  constructor(private readonly cfg: { merchantId: string; secretKey: string; allowedIps: string[] }) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const desc = 'Пополнение баланса GraderUP'
    const p = {
      merchant_id: this.cfg.merchantId,
      pay_id: input.paymentId,
      amount: input.amount,
      currency: 'RUB',
      desc,
      success_url: input.returnUrl,
      fail_url: input.returnUrl,
    }
    const sign = sha256([p.merchant_id, p.pay_id, p.amount, p.currency, p.desc, p.success_url, p.fail_url, this.cfg.secretKey].join(':'))
    return { externalId: input.paymentId, checkoutUrl: `https://anypay.io/merchant?${new URLSearchParams({ ...p, sign })}` }
  }

  async verifyWebhook(rawBody: string, _headers: Headers, ip?: string): Promise<WebhookEvent> {
    if (this.cfg.allowedIps.length && (!ip || !this.cfg.allowedIps.includes(ip))) throw new WebhookSignatureError()
    const q = new URLSearchParams(rawBody)
    const f = (k: string) => q.get(k) ?? ''
    if (f('merchant_id') !== this.cfg.merchantId) throw new WebhookSignatureError()
    const expected = sha256([f('currency'), f('amount'), f('pay_id'), f('merchant_id'), f('status'), this.cfg.secretKey].join(':'))
    if (!safeEqual(f('sign').toLowerCase(), expected)) throw new WebhookSignatureError()
    const status = f('status').toLowerCase()
    return {
      externalId: f('pay_id'),
      paymentId: f('pay_id'),
      status: status === 'paid' ? 'completed' : status === 'canceled' || status === 'refund' ? 'cancelled' : status === 'expired' ? 'expired' : 'pending',
      amount: f('amount'),
      currency: f('currency') || 'RUB',
      raw: Object.fromEntries(q),
    }
  }
}
