import type { MarketPrice, PriceProvider } from './PriceProvider'

/** Tries providers in order; later ones only fill names the earlier ones did not price. Failures are skipped. */
export class ChainPriceProvider implements PriceProvider {
  readonly id = 'auto'
  /** Per-name source id of the last fetch (e.g. 'marketcsgo', 'skinport'). */
  readonly sources = new Map<string, string>()
  readonly errors: string[] = []

  constructor(private readonly providers: PriceProvider[]) {}

  async fetchPrices(names: string[]) {
    const out = new Map<string, MarketPrice>()
    this.sources.clear()
    this.errors.length = 0
    for (const p of this.providers) {
      const missing = names.filter((n) => !out.has(n))
      if (missing.length === 0) break
      try {
        const got = await p.fetchPrices(missing)
        for (const [name, price] of got) {
          out.set(name, price)
          this.sources.set(name, p.id)
        }
      } catch (err) {
        this.errors.push(`${p.id}: ${(err as Error).message}`)
      }
    }
    return out
  }
}
