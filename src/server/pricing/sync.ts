import 'server-only'
import Decimal from 'decimal.js'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { D, toMoney } from '@/lib/money'
import { getDb } from '../db/client'
import { items } from '../db/schema'
import { logAdmin, logEvent } from '../services/log'
import { getSetting } from '../services/settings'
import { ChainPriceProvider } from './ChainPriceProvider'
import { estimateFromName } from './estimate'
import { MarketCsgoPriceProvider } from './MarketCsgoPriceProvider'
import { MockPriceProvider } from './MockPriceProvider'
import type { PriceProvider } from './PriceProvider'
import { SkinportPriceProvider } from './SkinportPriceProvider'
import { SteamMarketPriceProvider } from './SteamMarketPriceProvider'

/** Real RUB market prices: market.csgo.com first, Skinport fills the gaps. */
export function marketPriceChain() {
  const currency = process.env.PRICE_CURRENCY ?? 'RUB'
  return new ChainPriceProvider([new MarketCsgoPriceProvider(currency), new SkinportPriceProvider(currency)])
}

export async function getPriceProvider(id: string, current: Map<string, string>): Promise<PriceProvider | null> {
  switch (id) {
    case 'auto':
      return marketPriceChain()
    case 'marketcsgo':
      return new MarketCsgoPriceProvider(process.env.PRICE_CURRENCY ?? 'RUB')
    case 'skinport':
      return new SkinportPriceProvider(process.env.PRICE_CURRENCY ?? 'RUB')
    case 'steam':
      return new SteamMarketPriceProvider()
    case 'mock':
      return new MockPriceProvider(current)
    default:
      return null
  }
}

/**
 * Pulls market prices for every item with a market_hash_name (and not price-locked),
 * applies the configured markup/min price and updates items.price.
 * `reestimate`: items the market did not price and that still carry an estimate are re-priced with the
 * current offline estimator (fixes catalogues seeded with an older estimate).
 * NB: item prices drive case EV — rebuild/rebalance cases after a sync (`npm run prices:update` does it).
 */
export async function syncPrices(opts: { adminId?: string; dryRun?: boolean; provider?: string; reestimate?: boolean } = {}) {
  const cfg = await getSetting('pricing')
  const providerId = opts.provider ?? process.env.PRICE_PROVIDER ?? cfg.provider
  const db = getDb()
  const rows = await db
    .select()
    .from(items)
    .where(and(isNotNull(items.marketHashName), eq(items.priceLocked, false)))
  const current = new Map(rows.map((r) => [r.marketHashName!, r.marketPrice ?? r.price]))
  const provider = await getPriceProvider(providerId, current)
  let prices = new Map<string, { price: string }>()
  const errors: string[] = []
  if (provider) {
    try {
      prices = await provider.fetchPrices([...current.keys()])
    } catch (err) {
      if (!opts.reestimate) throw err
      errors.push((err as Error).message)
    }
    if (provider instanceof ChainPriceProvider) errors.push(...provider.errors)
  } else if (!opts.reestimate) {
    return { provider: providerId, updated: 0, missing: rows.length, total: rows.length, reestimated: 0, errors, changes: [] as unknown[] }
  }

  const changes: { id: string; name: string; from: string; to: string }[] = []
  const updates: { id: string; price: string; marketPrice: string | null; source: string }[] = []
  let reestimated = 0
  for (const r of rows) {
    const mp = prices.get(r.marketHashName!)
    let newPrice: string
    if (mp) {
      newPrice = toMoney(Decimal.max(D(mp.price).mul(1 + cfg.markupPercent / 100), cfg.minPrice))
      const source = provider instanceof ChainPriceProvider ? (provider.sources.get(r.marketHashName!) ?? provider.id) : provider!.id
      updates.push({ id: r.id, price: newPrice, marketPrice: mp.price, source })
    } else if (opts.reestimate && (r.priceSource === null || r.priceSource === 'estimate')) {
      newPrice = toMoney(Decimal.max(estimateFromName(r.marketHashName!, r.rarity), cfg.minPrice))
      updates.push({ id: r.id, price: newPrice, marketPrice: null, source: 'estimate' })
      reestimated++
    } else continue
    if (newPrice !== r.price) changes.push({ id: r.id, name: r.name, from: r.price, to: newPrice })
  }
  if (!opts.dryRun) {
    for (let i = 0; i < updates.length; i += 500) {
      const chunk = updates.slice(i, i + 500)
      const values = sql.join(
        chunk.map((u) => sql`(${u.id}::uuid, ${u.price}::numeric, ${u.marketPrice}::numeric, ${u.source})`),
        sql`, `,
      )
      await db.execute(sql`
        UPDATE items AS i SET price = v.price, market_price = v.market_price, price_source = v.source, price_updated_at = now(), updated_at = now()
        FROM (VALUES ${values}) AS v(id, price, market_price, source)
        WHERE i.id = v.id AND i.price_locked = false`)
    }
  }
  const id = provider?.id ?? 'none'
  const summary = { provider: id, total: rows.length, updated: prices.size, missing: rows.length - prices.size, reestimated, errors, changes: changes.slice(0, 200) }
  if (opts.adminId && !opts.dryRun) {
    await logAdmin(db, { adminId: opts.adminId, action: 'prices_sync', details: { provider: id, updated: prices.size, changed: changes.length } })
  }
  void logEvent('prices_sync', { details: { provider: id, updated: prices.size, reestimated, changed: changes.length, dryRun: Boolean(opts.dryRun) } })
  return summary
}
