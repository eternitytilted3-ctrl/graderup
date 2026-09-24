import { D } from '@/lib/money'
import type { MarketPrice, PriceProvider } from './PriceProvider'

/** Offline provider for dev/tests: moves each current price by up to ±5%. */
export class MockPriceProvider implements PriceProvider {
  readonly id = 'mock'
  constructor(private readonly current: Map<string, string>) {}
  async fetchPrices(names: string[]) {
    const out = new Map<string, MarketPrice>()
    for (const n of names) {
      const base = this.current.get(n)
      if (!base) continue
      const f = 1 + (Math.random() - 0.5) * 0.1
      out.set(n, { marketHashName: n, price: D(base).mul(f).toDecimalPlaces(2).toFixed(2), currency: 'RUB' })
    }
    return out
  }
}
