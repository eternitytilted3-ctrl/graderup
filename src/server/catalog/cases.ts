import 'server-only'
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { caseItems, cases, items } from '../db/schema'

/** Case line-up (prices in coins). Images are the original crate SVGs. */
export const CASE_PRESETS: { slug: string; name: string; price: number; description: string; featured?: boolean }[] = [
  { slug: 'starter', name: 'Starter', price: 49, description: 'Лёгкий старт: недорогие скины и шанс на редкость.', featured: true },
  { slug: 'neon-rush', name: 'Neon Rush', price: 149, description: 'Яркие раскраски и быстрые апгрейды.', featured: true },
  { slug: 'emerald', name: 'Emerald', price: 249, description: 'Зелёная коллекция с сюрпризами.' },
  { slug: 'night-ops', name: 'Night Ops', price: 399, description: 'Тёмные тактические скины.' },
  { slug: 'violet-core', name: 'Violet Core', price: 599, description: 'Фирменный фиолетовый кейс GraderUP.', featured: true },
  { slug: 'arctic', name: 'Arctic', price: 899, description: 'Ледяные расцветки.' },
  { slug: 'ember', name: 'Ember', price: 1299, description: 'Огненная коллекция с высоким потенциалом.' },
  { slug: 'lunar', name: 'Lunar', price: 1999, description: 'Для терпеливых охотников за редкостью.' },
  { slug: 'phantom', name: 'Phantom', price: 3499, description: 'Редкие раскраски и шанс на нож.', featured: true },
  { slug: 'prism', name: 'Prism', price: 4999, description: 'Переливающиеся скины всех оттенков.' },
  { slug: 'royal', name: 'Royal', price: 8999, description: 'Ножи, перчатки и Covert-скины.', featured: true },
  { slug: 'quantum', name: 'Quantum', price: 17999, description: 'Максимальные ставки.' },
]

/** Weights ∝ price^-k with k chosen by binary search so that EV ≈ price × rtp. */
export function weightsFor(prices: number[], casePrice: number, rtp: number) {
  const ev = (k: number) => {
    const w = prices.map((p) => Math.pow(p, -k))
    const sum = w.reduce((a, b) => a + b, 0)
    return prices.reduce((acc, p, i) => acc + (p * w[i]) / sum, 0)
  }
  let lo = 0
  let hi = 8
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (ev(mid) > casePrice * rtp) lo = mid
    else hi = mid
  }
  const w = prices.map((p) => Math.pow(p, -lo))
  const sum = w.reduce((a, b) => a + b, 0)
  return w.map((x) => Math.max(1, Math.round((x / sum) * 1_000_000)))
}

/**
 * (Re)builds case contents from the item catalogue: ~14 items per case spread across
 * [price × 0.08, price × 40] on a log scale, one item per weapon where possible, RTP ≈ 90%.
 */
export async function buildCases(opts: { rtp?: number; onlyWithMarketName?: boolean } = {}) {
  const db = getDb()
  const pool = await db
    .select()
    .from(items)
    .where(and(eq(items.isActive, true), opts.onlyWithMarketName ? isNotNull(items.marketHashName) : undefined))
    .orderBy(asc(items.price))
  if (pool.length === 0) throw new Error('No items to build cases from')
  const rtp = opts.rtp ?? 0.9
  let order = 0
  for (const preset of CASE_PRESETS) {
    const lo = preset.price * 0.08
    const hi = preset.price * 40
    const band = pool.filter((i) => Number(i.price) >= lo && Number(i.price) <= hi)
    if (band.length < 4) continue
    const want = Math.min(14, band.length)
    const picked = new Map<string, (typeof band)[number]>()
    const weaponsUsed = new Set<string>()
    for (let k = 0; k < want; k++) {
      // Target price on a log scale, then the nearest item with an unused weapon.
      const target = Math.exp(Math.log(lo) + ((Math.log(hi) - Math.log(lo)) * (k + 0.5)) / want)
      const sorted = [...band].sort((a, b) => Math.abs(Math.log(Number(a.price) / target)) - Math.abs(Math.log(Number(b.price) / target)))
      const choice = sorted.find((i) => !picked.has(i.id) && !weaponsUsed.has(i.name.split(' | ')[0])) ?? sorted.find((i) => !picked.has(i.id))
      if (!choice) continue
      picked.set(choice.id, choice)
      weaponsUsed.add(choice.name.split(' | ')[0])
    }
    const list = [...picked.values()]
    if (!list.some((i) => Number(i.price) < preset.price)) continue
    const weights = weightsFor(list.map((i) => Number(i.price)), preset.price, rtp)
    const total = weights.reduce((a, b) => a + b, 0)
    await db.transaction(async (tx) => {
      const [c] = await tx
        .insert(cases)
        .values({
          name: preset.name,
          slug: preset.slug,
          description: preset.description,
          image: `/assets/cases/${preset.slug}.svg`,
          price: preset.price.toFixed(2),
          sortOrder: order++,
          isFeatured: preset.featured ?? false,
        })
        .onConflictDoUpdate({ target: cases.slug, set: { price: sql`excluded.price`, description: sql`excluded.description`, updatedAt: new Date() } })
        .returning()
      await tx.delete(caseItems).where(eq(caseItems.caseId, c.id))
      await tx.insert(caseItems).values(list.map((i, idx) => ({ caseId: c.id, itemId: i.id, dropWeight: weights[idx], dropChance: ((weights[idx] / total) * 100).toFixed(5) })))
    })
  }
  return { cases: order }
}
