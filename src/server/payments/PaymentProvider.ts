/**
 * Payment provider abstraction. The browser NEVER confirms a payment: balance is credited
 * only after `verifyWebhook` succeeds for a server-to-server notification from the provider.
 */
export interface CreateCheckoutInput {
  paymentId: string
  userId: string
  amount: string
  currency: string
  returnUrl: string
  webhookUrl: string
}

export interface CheckoutSession {
  externalId: string
  checkoutUrl: string
}

export interface WebhookEvent {
  externalId: string
  /** Our payment id, if the provider echoes metadata back. */
  paymentId?: string
  status: 'completed' | 'failed' | 'cancelled' | 'expired' | 'pending'
  amount: string
  currency: string
  raw: unknown
}

export interface PaymentProvider {
  readonly id: string
  /** Shown on the deposit page. */
  readonly title: string
  readonly hint?: string
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>
  /** Verifies the signature of a raw webhook body and parses it. Throws on invalid signature. */
  verifyWebhook(rawBody: string, headers: Headers, ip?: string): Promise<WebhookEvent>
  /** Body the provider expects on a successfully processed webhook (default: JSON). */
  webhookAck?: string
}

export class WebhookSignatureError extends Error {
  constructor() {
    super('Invalid webhook signature')
  }
}
