/**
 * Market price source abstraction (CS2 skins etc). Implementations return prices keyed by
 * market_hash_name. Swap providers via PRICE_PROVIDER without touching the rest of the app.
 */
export interface MarketPrice {
  marketHashName: string
  price: string
  currency: string
}

export interface PriceProvider {
  readonly id: string
  /** Returns prices for the requested names; unknown names are simply absent from the map. */
  fetchPrices(names: string[]): Promise<Map<string, MarketPrice>>
}
