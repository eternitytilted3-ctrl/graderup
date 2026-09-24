import 'server-only'
import Decimal from 'decimal.js'
import { and, eq, isNotNull } from 'drizzle-orm'
import { D, toMoney } from '@/lib/money'
import { getDb } from '../db/client'
import { items } from '../db/schema'
import { logAdmin, logEvent } from '../services/log'
import { getSetting } from '../services/settings'
import { MockPriceProvider } from './MockPriceProvider'
import type { PriceProvider } from './PriceProvider'
import { SkinportPriceProvider } from './SkinportPriceProvider'
import { SteamMarketPriceProvider } from './SteamMarketPriceProvider'

export async function getPriceProvider(id: string, current: Map<string, string>): Promise<PriceProvider | null> {
  switch (id) {
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
 * NB: item prices drive case EV — review case RTP in the admin case editor after a sync.
 */
export async function syncPrices(opts: { adminId?: string; dryRun?: boolean } = {}) {
  const cfg = await getSetting('pricing')
  const providerId = process.env.PRICE_PROVIDER ?? cfg.provider
  const db = getDb()
  const rows = await db
    .select()
    .from(items)
    .where(and(isNotNull(items.marketHashName), eq(items.priceLocked, false)))
  const current = new Map(rows.map((r) => [r.marketHashName!, r.marketPrice ?? r.price]))
  const provider = await getPriceProvider(providerId, current)
  if (!provider) return { provider: providerId, updated: 0, missing: rows.length, total: rows.length, changes: [] as unknown[] }

  const prices = await provider.fetchPrices([...current.keys()])
  const changes: { id: string; name: string; from: string; to: string }[] = []
  for (const r of rows) {
    const mp = prices.get(r.marketHashName!)
    if (!mp) continue
    const newPrice = toMoney(Decimal.max(D(mp.price).mul(1 + cfg.markupPercent / 100), cfg.minPrice))
    if (!opts.dryRun) {
      await db
        .update(items)
        .set({ marketPrice: mp.price, price: newPrice, priceSource: provider.id, priceUpdatedAt: new Date(), updatedAt: new Date() })
        .where(eq(items.id, r.id))
    }
    if (newPrice !== r.price) changes.push({ id: r.id, name: r.name, from: r.price, to: newPrice })
  }
  const summary = { provider: provider.id, total: rows.length, updated: prices.size, missing: rows.length - prices.size, changes: changes.slice(0, 200) }
  if (opts.adminId && !opts.dryRun) {
    await logAdmin(db, { adminId: opts.adminId, action: 'prices_sync', details: { provider: provider.id, updated: prices.size, changed: changes.length } })
  }
  void logEvent('prices_sync', { details: { provider: provider.id, updated: prices.size, changed: changes.length, dryRun: Boolean(opts.dryRun) } })
  return summary
}
