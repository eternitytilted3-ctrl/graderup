import 'server-only'
import { env } from '@/config/env'
import { AnyPayPaymentProvider } from './AnyPayPaymentProvider'
import { MockPaymentProvider } from './MockPaymentProvider'
import { PallyPaymentProvider } from './PallyPaymentProvider'
import type { PaymentProvider } from './PaymentProvider'
import { RealPaymentProvider } from './RealPaymentProvider'
import { XRocketPaymentProvider } from './XRocketPaymentProvider'

export function mockAllowed() {
  const cfg = env()
  return cfg.PAYMENT_PROVIDER === 'mock' && (cfg.NODE_ENV !== 'production' || cfg.ALLOW_MOCK_PAYMENTS_IN_PRODUCTION)
}

/** All providers enabled by configuration (a provider is on when its credentials are set). */
export function enabledPaymentProviders(): PaymentProvider[] {
  const cfg = env()
  const list: PaymentProvider[] = []
  if (cfg.PALLY_API_TOKEN && cfg.PALLY_SHOP_ID) list.push(new PallyPaymentProvider({ apiToken: cfg.PALLY_API_TOKEN, shopId: cfg.PALLY_SHOP_ID, apiUrl: cfg.PALLY_API_URL }))
  if (cfg.ANYPAY_MERCHANT_ID && cfg.ANYPAY_SECRET_KEY) list.push(new AnyPayPaymentProvider({ merchantId: cfg.ANYPAY_MERCHANT_ID, secretKey: cfg.ANYPAY_SECRET_KEY, allowedIps: cfg.ANYPAY_ALLOWED_IPS }))
  if (cfg.XROCKET_API_KEY)
    list.push(new XRocketPaymentProvider({ apiKey: cfg.XROCKET_API_KEY, apiUrl: cfg.XROCKET_API_URL, currency: cfg.XROCKET_CURRENCY, coinsPerUnit: cfg.XROCKET_COINS_PER_UNIT }))
  if (cfg.PAYMENT_PROVIDER === 'real' && cfg.REAL_PAYMENT_API_URL)
    list.push(new RealPaymentProvider({ apiUrl: cfg.REAL_PAYMENT_API_URL, apiKey: cfg.REAL_PAYMENT_API_KEY, merchantId: cfg.REAL_PAYMENT_MERCHANT_ID, webhookSecret: cfg.PAYMENT_SECRET }))
  if (mockAllowed()) list.push(new MockPaymentProvider(cfg.PAYMENT_SECRET, cfg.APP_URL))
  return list
}

/** Returns an enabled provider or null. Default = first enabled. */
export function findPaymentProvider(id?: string): PaymentProvider | null {
  const list = enabledPaymentProviders()
  return (id ? list.find((p) => p.id === id) : list[0]) ?? null
}

export function getPaymentProvider(id?: string): PaymentProvider {
  const p = findPaymentProvider(id)
  if (!p) throw new Error(`Payment provider not enabled: ${id ?? '(default)'}`)
  return p
}

export function getMockProvider() {
  return getPaymentProvider('mock') as MockPaymentProvider
}
