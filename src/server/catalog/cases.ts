import 'server-only'
import { asc, eq, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { caseCategories, caseItems, cases, items } from '../db/schema'

export const CASE_CATEGORIES = [
  { slug: 'new', name: 'Новинки', sortOrder: 0 },
  { slug: 'budget', name: 'Бюджетные', sortOrder: 1 },
  { slug: 'classic', name: 'Классика', sortOrder: 2 },
  { slug: 'collections', name: 'Цветная коллекция', sortOrder: 3 },
  { slug: 'knives', name: 'Ножи и перчатки', sortOrder: 4 },
  { slug: 'limited', name: 'Limited', sortOrder: 5 },
] as const

type CategorySlug = (typeof CASE_CATEGORIES)[number]['slug']

export interface CasePreset {
  slug: string
  name: string
  price: number
  category: CategorySlug
  description: string
  featured?: boolean
  /** Restrict the rare end of the drop list (e.g. knives-only case). */
  theme?: 'knives' | 'gloves'
}

/** Case line-up (prices in coins). Art: public/assets/cases/<slug>.svg (scripts/generate-assets.mjs). */
export const CASE_PRESETS: CasePreset[] = [
  { slug: 'magnum', name: 'Магнум', price: 19, category: 'budget', description: 'Самый доступный кейс — идеален для первого открытия.', featured: true },
  { slug: 'exposure', name: 'Экспозиция', price: 39, category: 'budget', description: 'Недорогие скины с шансом на редкость.' },
  { slug: 'sprint', name: 'Спринт', price: 50, category: 'budget', description: 'Быстрые пистолеты и пистолеты-пулемёты.' },
  { slug: 'ricochet', name: 'Рикошет', price: 75, category: 'budget', description: 'Дробовики, SMG и немного везения.' },
  { slug: 'neo', name: 'Нео', price: 120, category: 'new', description: 'Свежая неоновая сборка.', featured: true },
  { slug: 'steel', name: 'Сталь', price: 145, category: 'classic', description: 'Надёжная классика для стабильных дропов.' },
  { slug: 'desert', name: 'Пустыня', price: 199, category: 'classic', description: 'Песочные раскраски и винтовки.' },
  { slug: 'fog', name: 'Туман', price: 300, category: 'new', description: 'Тёмные тактические скины.', featured: true },
  { slug: 'green', name: 'Зелёный', price: 499, category: 'collections', description: 'Цветная коллекция: зелёный.' },
  { slug: 'yellow', name: 'Жёлтый', price: 799, category: 'collections', description: 'Цветная коллекция: жёлтый.' },
  { slug: 'blue', name: 'Синий', price: 1299, category: 'collections', description: 'Цветная коллекция: синий.' },
  { slug: 'red', name: 'Красный', price: 1999, category: 'collections', description: 'Цветная коллекция: красный.', featured: true },
  { slug: 'blade', name: 'Клинок', price: 2999, category: 'knives', description: 'Шанс на нож ★ в каждом открытии.', theme: 'knives', featured: true },
  { slug: 'gloves', name: 'Перчатки', price: 4999, category: 'knives', description: 'Перчатки ★ и дорогие винтовки.', theme: 'gloves' },
  { slug: 'aurora', name: 'Аврора', price: 7999, category: 'limited', description: 'Лимитированный кейс с Covert-скинами.' },
  { slug: 'monolith', name: 'Монолит', price: 12999, category: 'limited', description: 'Для хайроллеров.' },
  { slug: 'premium', name: 'Премиум', price: 17999, category: 'limited', description: 'Максимальные ставки — максимальные дропы.', featured: true },
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
 * (Re)builds categories and case contents from the item catalogue: ~14 items per case spread across
 * [price × 0.1, price × 40] on a log scale, one item per weapon where possible, RTP ≈ 90%.
 * Themed cases (knives/gloves) take their expensive end only from ★ items of that kind.
 */
export async function buildCases(opts: { rtp?: number } = {}) {
  const db = getDb()
  const pool = await db.select().from(items).where(eq(items.isActive, true)).orderBy(asc(items.price))
  if (pool.length === 0) throw new Error('No items to build cases from')
  const rtp = opts.rtp ?? 0.9

  const catIds = new Map<string, string>()
  for (const c of CASE_CATEGORIES) {
    const [row] = await db
      .insert(caseCategories)
      .values({ slug: c.slug, name: c.name, sortOrder: c.sortOrder })
      .onConflictDoUpdate({ target: caseCategories.slug, set: { name: c.name, sortOrder: c.sortOrder } })
      .returning()
    catIds.set(c.slug, row.id)
  }

  const isKnife = (name: string) => name.startsWith('★') && !/Gloves|Wraps/i.test(name)
  const isGloves = (name: string) => name.startsWith('★') && /Gloves|Wraps/i.test(name)
  let order = 0
  for (const preset of CASE_PRESETS) {
    const lo = preset.price * 0.1
    const hi = preset.price * 40
    let band = pool.filter((i) => Number(i.price) >= lo && Number(i.price) <= hi)
    if (preset.theme) {
      const special = pool.filter((i) => (preset.theme === 'knives' ? isKnife(i.name) : isGloves(i.name)) && Number(i.price) <= hi * 3)
      band = [...band.filter((i) => Number(i.price) < preset.price * 1.5 && !i.name.startsWith('★')), ...special]
    }
    if (band.length < 4) continue
    const want = Math.min(14, band.length)
    const picked = new Map<string, (typeof band)[number]>()
    const weaponsUsed = new Set<string>()
    const bandLo = Math.max(lo, Number(band[0].price))
    const bandHi = Math.max(...band.map((b) => Number(b.price)))
    for (let k = 0; k < want; k++) {
      const target = Math.exp(Math.log(bandLo) + ((Math.log(bandHi) - Math.log(bandLo)) * (k + 0.5)) / want)
      const sorted = [...band].sort((a, b) => Math.abs(Math.log(Number(a.price) / target)) - Math.abs(Math.log(Number(b.price) / target)))
      const choice = sorted.find((i) => !picked.has(i.id) && !weaponsUsed.has(i.name.split(' | ')[0])) ?? sorted.find((i) => !picked.has(i.id))
      if (!choice) continue
      picked.set(choice.id, choice)
      weaponsUsed.add(choice.name.split(' | ')[0])
    }
    // Guarantee at least 3 items cheaper than the case (otherwise EV/RTP cannot be met).
    const cheap = band.filter((i) => Number(i.price) < preset.price && !picked.has(i.id))
    while ([...picked.values()].filter((i) => Number(i.price) < preset.price).length < 3 && cheap.length) {
      const c = cheap.pop()!
      picked.set(c.id, c)
    }
    const list = [...picked.values()]
    if (!list.some((i) => Number(i.price) < preset.price) || !list.some((i) => Number(i.price) > preset.price)) continue
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
          categoryId: catIds.get(preset.category) ?? null,
        })
        .onConflictDoUpdate({
          target: cases.slug,
          set: { price: sql`excluded.price`, description: sql`excluded.description`, categoryId: sql`excluded.category_id`, updatedAt: new Date() },
        })
        .returning()
      await tx.delete(caseItems).where(eq(caseItems.caseId, c.id))
      await tx.insert(caseItems).values(list.map((i, idx) => ({ caseId: c.id, itemId: i.id, dropWeight: weights[idx], dropChance: ((weights[idx] / total) * 100).toFixed(5) })))
    })
  }
  return { cases: order }
}
