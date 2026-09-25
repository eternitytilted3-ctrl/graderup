import 'server-only'
import { sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { items, type Rarity } from '../db/schema'
import { estimateRubPrice } from '../pricing/estimate'
import { marketPriceChain } from '../pricing/sync'

/**
 * CS2 skin catalogue importer.
 * Source: ByMykel/CSGO-API (community-maintained JSON of CS2 items, images on Steam's CDN).
 * ⚠️ Skin names and images are Valve Corporation IP. Check Valve's/Steam's terms and
 *    get legal advice before using them commercially.
 */
export const CS2_SKINS_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json'

interface RawSkin {
  name: string
  market_hash_name: string | null
  image: string | null
  stattrak: boolean
  souvenir: boolean
  rarity: { id: string; name: string } | null
  category: { id: string; name: string } | null
  weapon: { id: string; name: string } | null
  wear: { id: string; name: string } | null
  pattern?: { name: string } | null
}

export interface Cs2Skin {
  marketHashName: string
  image: string
  rarity: Rarity
  weapon: string
  category: string
  wear: string | null
  pattern: string | null
  isKnifeOrGloves: boolean
  description: string
}

const RARITY_MAP: Record<string, Rarity> = {
  rarity_common_weapon: 'common',
  rarity_common: 'common',
  rarity_uncommon_weapon: 'uncommon',
  rarity_uncommon: 'uncommon',
  rarity_rare_weapon: 'rare',
  rarity_rare: 'rare',
  rarity_mythical_weapon: 'epic',
  rarity_mythical: 'epic',
  rarity_legendary_weapon: 'legendary',
  rarity_legendary: 'legendary',
  rarity_ancient_weapon: 'mythic',
  rarity_ancient: 'mythic',
  rarity_contraband_weapon: 'mythic',
  rarity_contraband: 'mythic',
}

export async function fetchCs2Skins(): Promise<Cs2Skin[]> {
  const res = await fetch(CS2_SKINS_URL, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`CS2 catalogue HTTP ${res.status}`)
  const raw = (await res.json()) as RawSkin[]
  const out: Cs2Skin[] = []
  const seen = new Set<string>()
  for (const s of raw) {
    const name = s.market_hash_name ?? s.name
    if (!name || !s.image || s.stattrak || s.souvenir || !s.rarity) continue
    const rarity = RARITY_MAP[s.rarity.id]
    if (!rarity || seen.has(name)) continue
    seen.add(name)
    const category = s.category?.name ?? ''
    out.push({
      marketHashName: name,
      // Steam economy images accept a size suffix; 360px is plenty for cards.
      image: `${s.image}/360fx360f`,
      rarity,
      weapon: s.weapon?.name ?? '',
      category,
      wear: s.wear?.name ?? null,
      pattern: s.pattern?.name ?? null,
      isKnifeOrGloves: name.startsWith('★'),
      description: [s.weapon?.name, s.pattern?.name, s.wear?.name].filter(Boolean).join(' · '),
    })
  }
  return out
}

/**
 * Upserts CS2 skins into `items` (matched by market_hash_name). Prices in RUB (= coins):
 * market.csgo.com → Skinport → offline estimate (price_source = 'estimate') for anything left.
 */
export async function importCs2Catalog(opts: { log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => {})
  const skins = await fetchCs2Skins()
  log(`catalogue: ${skins.length} skins`)
  const chain = marketPriceChain()
  const prices = await chain.fetchPrices(skins.map((s) => s.marketHashName))
  for (const e of chain.errors) log(`price source unavailable — ${e}`)
  log(`market prices: ${prices.size}/${skins.length}${prices.size < skins.length ? ' (rest: estimate)' : ''}`)
  const db = getDb()
  const rows = skins.map((s) => {
    const market = prices.get(s.marketHashName)?.price
    const price = market ?? estimateRubPrice(s).toFixed(2)
    return {
      name: s.marketHashName,
      marketHashName: s.marketHashName,
      image: s.image,
      rarity: s.rarity,
      description: s.description,
      baseName: s.marketHashName.replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/, ''),
      wear: s.wear,
      price,
      marketPrice: market ?? null,
      priceSource: market ? (chain.sources.get(s.marketHashName) ?? 'market') : 'estimate',
      priceUpdatedAt: new Date(),
    }
  })
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(items)
      .values(rows.slice(i, i + 500))
      .onConflictDoUpdate({
        target: items.marketHashName,
        set: {
          image: sql`excluded.image`,
          rarity: sql`excluded.rarity`,
          description: sql`excluded.description`,
          baseName: sql`excluded.base_name`,
          wear: sql`excluded.wear`,
          marketPrice: sql`excluded.market_price`,
          priceSource: sql`excluded.price_source`,
          priceUpdatedAt: sql`excluded.price_updated_at`,
          // Never overwrite manually locked prices.
          price: sql`CASE WHEN ${items.priceLocked} THEN ${items.price} ELSE excluded.price END`,
          updatedAt: new Date(),
        },
      })
  }
  log(`imported ${rows.length} items`)
  return { count: rows.length, marketPriced: prices.size }
}
