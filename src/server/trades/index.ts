import 'server-only'
import { env } from '@/config/env'
import { MarketCsgoTradeProvider } from './MarketCsgoTradeProvider'
import { MockTradeProvider } from './MockTradeProvider'
import type { TradeProvider } from './TradeProvider'

/** Mock trades never run in production unless explicitly allowed for a staging stand. */
export function tradesMockAllowed() {
  const cfg = env()
  return cfg.NODE_ENV !== 'production' || cfg.ALLOW_MOCK_TRADES_IN_PRODUCTION
}

/** Returns the configured trade provider or null (skin withdrawal is then unavailable). */
export function getTradeProvider(): TradeProvider | null {
  const cfg = env()
  if (cfg.TRADE_PROVIDER === 'marketcsgo' && cfg.MARKETCSGO_API_KEY) {
    return new MarketCsgoTradeProvider({ apiKey: cfg.MARKETCSGO_API_KEY, apiUrl: cfg.MARKETCSGO_API_URL, maxOverpayPercent: cfg.MARKETCSGO_MAX_OVERPAY_PERCENT })
  }
  if (cfg.TRADE_PROVIDER === 'mock' && tradesMockAllowed()) return new MockTradeProvider()
  return null
}
