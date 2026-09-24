import type { MarketPrice, PriceProvider } from './PriceProvider'

/**
 * Skinport public items API (bulk, no key needed; rate limited ~8 req / 5 min, cached 5 min on their side).
 * Docs: https://docs.skinport.com/items  — check their Terms of Use before commercial use.
 */
export class SkinportPriceProvider implements PriceProvider {
  readonly id = 'skinport'
  constructor(
    private readonly currency = 'USD',
    private readonly field: 'suggested_price' | 'min_price' | 'median_price' = 'suggested_price',
  ) {}

  async fetchPrices(names: string[]) {
    const res = await fetch(`https://api.skinport.com/v1/items?app_id=730&currency=${this.currency}&tradable=0`, {
      headers: { 'accept-encoding': 'br', accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Skinport HTTP ${res.status}`)
    const data = (await res.json()) as { market_hash_name: string; suggested_price: number | null; min_price: number | null; median_price: number | null; currency: string }[]
    const wanted = new Set(names)
    const out = new Map<string, MarketPrice>()
    for (const row of data) {
      if (!wanted.has(row.market_hash_name)) continue
      const p = row[this.field] ?? row.suggested_price ?? row.min_price
      if (p && p > 0) out.set(row.market_hash_name, { marketHashName: row.market_hash_name, price: p.toFixed(2), currency: row.currency })
    }
    return out
  }
}
