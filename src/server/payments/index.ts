import 'server-only'
import { env } from '@/config/env'
import { MockPaymentProvider } from './MockPaymentProvider'
import type { PaymentProvider } from './PaymentProvider'
import { RealPaymentProvider } from './RealPaymentProvider'

export function mockAllowed() {
  const cfg = env()
  return cfg.PAYMENT_PROVIDER === 'mock' && (cfg.NODE_ENV !== 'production' || cfg.ALLOW_MOCK_PAYMENTS_IN_PRODUCTION)
}

export function getPaymentProvider(id?: string): PaymentProvider {
  const cfg = env()
  const which = id ?? cfg.PAYMENT_PROVIDER
  if (which === 'mock') {
    if (!mockAllowed()) throw new Error('Mock payment provider is disabled in production')
    return new MockPaymentProvider(cfg.PAYMENT_SECRET, cfg.APP_URL)
  }
  if (which === 'real') {
    return new RealPaymentProvider({
      apiUrl: cfg.REAL_PAYMENT_API_URL,
      apiKey: cfg.REAL_PAYMENT_API_KEY,
      merchantId: cfg.REAL_PAYMENT_MERCHANT_ID,
      webhookSecret: cfg.PAYMENT_SECRET,
    })
  }
  throw new Error(`Unknown payment provider: ${which}`)
}

export function getMockProvider() {
  const p = getPaymentProvider('mock')
  return p as MockPaymentProvider
}
