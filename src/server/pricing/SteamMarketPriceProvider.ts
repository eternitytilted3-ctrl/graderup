import type { MarketPrice, PriceProvider } from './PriceProvider'

/**
 * Steam Community Market `priceoverview` (one request per item, strict rate limits ≈ 20 req/min).
 * Suitable for small catalogues; for large ones use a bulk provider.
 */
export class SteamMarketPriceProvider implements PriceProvider {
  readonly id = 'steam'
  constructor(
    private readonly currencyCode = 1 /* USD */,
    private readonly delayMs = 3500,
  ) {}

  async fetchPrices(names: string[]) {
    const out = new Map<string, MarketPrice>()
    for (const name of names) {
      try {
        const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${this.currencyCode}&market_hash_name=${encodeURIComponent(name)}`
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
        if (res.ok) {
          const d = (await res.json()) as { success: boolean; lowest_price?: string; median_price?: string }
          const raw = d.median_price ?? d.lowest_price
          const num = raw ? Number(raw.replace(/[^\d.,]/g, '').replace(',', '.')) : NaN
          if (d.success && num > 0) out.set(name, { marketHashName: name, price: num.toFixed(2), currency: 'USD' })
        }
      } catch {
        // skip item on error; next sync will retry
      }
      await new Promise((r) => setTimeout(r, this.delayMs))
    }
    return out
  }
}
