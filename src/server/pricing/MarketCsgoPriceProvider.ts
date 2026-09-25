import type { MarketPrice, PriceProvider } from './PriceProvider'

/**
 * market.csgo.com public price list — prices are native RUB (lowest sell offer), one bulk request, no key.
 * Endpoint: https://market.csgo.com/api/v2/prices/RUB.json — check their Terms of Use before commercial use.
 */
export class MarketCsgoPriceProvider implements PriceProvider {
  readonly id = 'marketcsgo'
  constructor(
    private readonly currency = 'RUB',
    /** Ignore offers with fewer listings than this (thin listings are often outliers). */
    private readonly minVolume = 1,
  ) {}

  async fetchPrices(names: string[]) {
    const res = await fetch(`https://market.csgo.com/api/v2/prices/${this.currency}.json`, {
      headers: { accept: 'application/json', 'user-agent': 'GraderUP price sync' },
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`market.csgo.com HTTP ${res.status}`)
    const data = (await res.json()) as { success?: boolean; currency?: string; items?: { market_hash_name: string; price: string | number; volume?: string | number }[] }
    if (!data.success || !Array.isArray(data.items)) throw new Error('market.csgo.com: unexpected response')
    const wanted = new Set(names)
    const out = new Map<string, MarketPrice>()
    for (const row of data.items) {
      if (!wanted.has(row.market_hash_name)) continue
      const p = Number(row.price)
      if (!(p > 0) || Number(row.volume ?? 1) < this.minVolume) continue
      out.set(row.market_hash_name, { marketHashName: row.market_hash_name, price: p.toFixed(2), currency: data.currency ?? this.currency })
    }
    return out
  }
}
