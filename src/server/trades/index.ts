import 'server-only'
import { env } from '@/config/env'
import { MockTradeProvider } from './MockTradeProvider'
import type { TradeProvider } from './TradeProvider'

/** Mock trades never run in production unless explicitly allowed for a staging stand. */
export function tradesMockAllowed() {
  const cfg = env()
  return cfg.NODE_ENV !== 'production' || cfg.ALLOW_MOCK_TRADES_IN_PRODUCTION
}

/**
 * Returns the configured trade provider or null (skin withdrawal is then unavailable).
 * TODO: add a real adapter (e.g. a CS2 marketplace "buy-for" API or own Steam bots) and select it via TRADE_PROVIDER.
 */
export function getTradeProvider(): TradeProvider | null {
  const cfg = env()
  if (cfg.TRADE_PROVIDER === 'mock' && tradesMockAllowed()) return new MockTradeProvider()
  return null
}
