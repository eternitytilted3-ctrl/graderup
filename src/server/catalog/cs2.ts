import 'server-only'
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { items, type Rarity } from '../db/schema'
import { SkinportPriceProvider } from '../pricing/SkinportPriceProvider'

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
      isKnifeOrGloves: name.startsWith('★'),
      description: [s.weapon?.name, s.pattern?.name, s.wear?.name].filter(Boolean).join(' · '),
    })
  }
  return out
}

const WEAR_MULT: Record<string, number> = { 'Factory New': 1.7, 'Minimal Wear': 1.3, 'Field-Tested': 1, 'Well-Worn': 0.85, 'Battle-Scarred': 0.75 }
const RARITY_RANGE: Record<Rarity, [number, number]> = {
  common: [3, 15],
  uncommon: [8, 60],
  rare: [25, 400],
  epic: [150, 2500],
  legendary: [700, 12000],
  mythic: [2500, 45000],
}

/** Deterministic price estimate (coins) used only when no market price source is reachable. */
export function estimatePrice(s: Cs2Skin): number {
  const h = createHash('sha1').update(s.marketHashName.replace(/\s*\(.*\)$/, '')).digest()
  const u = h.readUInt32BE(0) / 0xffffffff
  let [lo, hi] = RARITY_RANGE[s.rarity]
  if (s.isKnifeOrGloves) [lo, hi] = [9000, 160000]
  const base = Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * u)
  const price = base * (WEAR_MULT[s.wear ?? ''] ?? 1)
  return Math.max(3, Math.round(price * 100) / 100)
}

/**
 * Upserts CS2 skins into `items` (matched by market_hash_name). Prices: Skinport (RUB = coins)
 * when reachable, otherwise a deterministic estimate (price_source = 'estimate').
 */
export async function importCs2Catalog(opts: { log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => {})
  const skins = await fetchCs2Skins()
  log(`catalogue: ${skins.length} skins`)
  let prices = new Map<string, { price: string }>()
  let source = 'estimate'
  try {
    prices = await new SkinportPriceProvider('RUB').fetchPrices(skins.map((s) => s.marketHashName))
    if (prices.size > 0) source = 'skinport'
    log(`skinport prices: ${prices.size}`)
  } catch (err) {
    log(`skinport unavailable (${(err as Error).message}) — using estimated prices`)
  }
  const db = getDb()
  const rows = skins.map((s) => {
    const market = prices.get(s.marketHashName)?.price
    const price = market ?? estimatePrice(s).toFixed(2)
    return {
      name: s.marketHashName,
      marketHashName: s.marketHashName,
      image: s.image,
      rarity: s.rarity,
      description: s.description,
      price,
      marketPrice: market ?? null,
      priceSource: market ? source : 'estimate',
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
          marketPrice: sql`excluded.market_price`,
          priceSource: sql`excluded.price_source`,
          priceUpdatedAt: sql`excluded.price_updated_at`,
          // Never overwrite manually locked prices.
          price: sql`CASE WHEN ${items.priceLocked} THEN ${items.price} ELSE excluded.price END`,
          updatedAt: new Date(),
        },
      })
  }
  log(`imported ${rows.length} items (prices: ${source})`)
  return { count: rows.length, priceSource: source }
}
