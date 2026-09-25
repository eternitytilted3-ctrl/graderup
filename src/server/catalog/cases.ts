import 'server-only'
import { asc, eq, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { caseCategories, caseItems, cases, items } from '../db/schema'
import { getSetting } from '../services/settings'
import { familyExpectedPrice } from '../services/wear'

export const CASE_CATEGORIES = [
  { slug: 'budget', name: 'Бюджетные', sortOrder: 1 },
  { slug: 'classic', name: 'Классика', sortOrder: 2 },
  { slug: 'collections', name: 'Цветная коллекция', sortOrder: 3 },
  { slug: 'knife-types', name: 'Ножевые кейсы', sortOrder: 4 },
  { slug: 'limited', name: 'Премиум и Limited', sortOrder: 5 },
] as const

type CategorySlug = (typeof CASE_CATEGORIES)[number]['slug']

export interface CasePreset {
  slug: string
  name: string
  /** Case price in coins; omitted → derived from the contents (knife / gloves cases). */
  price?: number
  category: CategorySlug
  description: string
  featured?: boolean
  /** Restrict the rare end of the drop list (e.g. knives-only case). */
  theme?: 'knives' | 'gloves'
  /** Knife-type case: rare end = only this knife (CS2 market prefix after "★ "), e.g. "Gut Knife". */
  knife?: string
  /** Card ribbon (limited-category cases default to 'limited'). */
  badge?: 'limited' | 'new' | 'hot'
  /** Limited-time case: ends this many days after it is first created (editable in the admin). */
  endsInDays?: number
}

/** Case line-up (prices in coins). Art: public/assets/cases/<slug>.svg (scripts/generate-assets.mjs). */
export const CASE_PRESETS: CasePreset[] = [
  { slug: 'magnum', name: 'Магнум', price: 19, category: 'budget', description: 'Самый доступный кейс — идеален для первого открытия.', featured: true },
  { slug: 'exposure', name: 'Экспозиция', price: 39, category: 'budget', description: 'Недорогие скины с шансом на редкость.' },
  { slug: 'sprint', name: 'Спринт', price: 50, category: 'budget', description: 'Быстрые пистолеты и пистолеты-пулемёты.' },
  { slug: 'ricochet', name: 'Рикошет', price: 75, category: 'budget', description: 'Дробовики, SMG и немного везения.' },
  { slug: 'buckshot', name: 'Картечь', price: 99, category: 'budget', description: 'Дробовики и пистолеты-пулемёты.' },
  { slug: 'sidearm', name: 'Табельный', price: 249, category: 'classic', description: 'Пистолеты на любой вкус.' },
  { slug: 'scope', name: 'Прицел', price: 399, category: 'collections', description: 'Снайперские винтовки и не только.', featured: true },
  { slug: 'neo', name: 'Нео', price: 120, category: 'classic', description: 'Свежая неоновая сборка.', featured: true },
  { slug: 'steel', name: 'Сталь', price: 145, category: 'classic', description: 'Надёжная классика для стабильных дропов.' },
  { slug: 'desert', name: 'Пустыня', price: 199, category: 'classic', description: 'Песочные раскраски и винтовки.' },
  { slug: 'fog', name: 'Туман', price: 300, category: 'classic', description: 'Тёмные тактические скины.', featured: true },
  { slug: 'green', name: 'Зелёный', price: 499, category: 'collections', description: 'Цветная коллекция: зелёный.' },
  { slug: 'yellow', name: 'Жёлтый', price: 799, category: 'collections', description: 'Цветная коллекция: жёлтый.' },
  { slug: 'blue', name: 'Синий', price: 1299, category: 'collections', description: 'Цветная коллекция: синий.' },
  { slug: 'red', name: 'Красный', price: 1999, category: 'collections', description: 'Цветная коллекция: красный.', featured: true },
  { slug: 'blade', name: 'Клинок', category: 'limited', description: 'Только ножи ★ — любой модели и раскраски.', theme: 'knives', featured: true },
  { slug: 'gloves', name: 'Перчатки', category: 'limited', description: 'Только перчатки ★.', theme: 'gloves' },
  // ── Knife-type cases: every case holds one CS2 knife model (all its finishes) + cheaper skins ──
  { slug: 'hook', name: 'Крюк', category: 'knife-types', description: 'Ножи с лезвием-крюком (Gut Knife) во всех раскрасках.', knife: 'Gut Knife', featured: true },
  { slug: 'kukri', name: 'Кукри', category: 'knife-types', description: 'Изогнутый клинок Кукри — новинка CS2.', knife: 'Kukri Knife', featured: true, badge: 'new' },
  { slug: 'karambit', name: 'Коготь тигра', category: 'knife-types', description: 'Легендарный Керамбит во всех раскрасках.', knife: 'Karambit', featured: true },
  { slug: 'butterfly', name: 'Мотылёк', category: 'knife-types', description: 'Нож-бабочка для любителей трюков.', knife: 'Butterfly Knife' },
  { slug: 'm9', name: 'Штык M9', category: 'knife-types', description: 'Штык-нож M9 — классика дорогих дропов.', knife: 'M9 Bayonet' },
  { slug: 'bayonet', name: 'Штык', category: 'knife-types', description: 'Штык-нож в любой отделке.', knife: 'Bayonet' },
  { slug: 'falchion', name: 'Фальшион', category: 'knife-types', description: 'Фальшион с широким изогнутым клинком.', knife: 'Falchion Knife' },
  { slug: 'huntsman', name: 'Егерь', category: 'knife-types', description: 'Охотничий нож с пилой на обухе.', knife: 'Huntsman Knife' },
  { slug: 'bowie', name: 'Боуи', category: 'knife-types', description: 'Массивный нож Боуи.', knife: 'Bowie Knife' },
  { slug: 'daggers', name: 'Тени', category: 'knife-types', description: 'Тычковые ножи — самый доступный нож ★.', knife: 'Shadow Daggers' },
  { slug: 'navaja', name: 'Наваха', category: 'knife-types', description: 'Складная наваха по бюджетной цене.', knife: 'Navaja Knife' },
  { slug: 'stiletto', name: 'Стилет', category: 'knife-types', description: 'Изящный выкидной стилет.', knife: 'Stiletto Knife' },
  { slug: 'talon', name: 'Талон', category: 'knife-types', description: 'Нож-коготь Talon.', knife: 'Talon Knife' },
  { slug: 'ursus', name: 'Медведь', category: 'knife-types', description: 'Складной нож Урсус.', knife: 'Ursus Knife' },
  { slug: 'classic', name: 'Оригинал', category: 'knife-types', description: 'Классический нож из первых версий CS.', knife: 'Classic Knife' },
  { slug: 'paracord', name: 'Паракорд', category: 'knife-types', description: 'Нож с рукоятью в оплётке паракорда.', knife: 'Paracord Knife' },
  { slug: 'survival', name: 'Выживший', category: 'knife-types', description: 'Нож для выживания с пилой.', knife: 'Survival Knife' },
  { slug: 'nomad', name: 'Кочевник', category: 'knife-types', description: 'Nomad — крепкий нож для любых условий.', knife: 'Nomad Knife' },
  { slug: 'skeleton', name: 'Скелет', category: 'knife-types', description: 'Скелетный нож с облегчённой рукоятью.', knife: 'Skeleton Knife' },
  { slug: 'flip', name: 'Флип', category: 'knife-types', description: 'Складной Flip Knife.', knife: 'Flip Knife' },
  { slug: 'aurora', name: 'Аврора', price: 7999, category: 'limited', description: 'Лимитированный кейс с Covert-скинами.', endsInDays: 21 },
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
 * (Re)builds categories and case contents from the item catalogue. Weapon cases: ~14 non-★ skins spread
 * over [price × 0.1, price × 40] on a log scale, one per weapon where possible. Knife / gloves cases: ONLY
 * ★ items of that model/kind, spread by price, case price derived from the cheapest one. Weights give
 * EV = price × RTP (settings.cases.rtp).
 */
export async function buildCases(opts: { rtp?: number } = {}) {
  const db = getDb()
  const all = await db.select().from(items).where(eq(items.isActive, true)).orderBy(asc(items.price))
  if (all.length === 0) throw new Error('No items to build cases from')
  const [casesCfg, dropCfg] = await Promise.all([getSetting('cases'), getSetting('drops')])
  const rtp = opts.rtp ?? casesCfg.rtp
  // One entry per skin (exterior is rolled on drop): representative = Field-Tested if present.
  const families = new Map<string, (typeof all)[number][]>()
  for (const i of all) {
    const key = i.baseName ?? i.name
    families.set(key, [...(families.get(key) ?? []), i])
  }
  const expected = new Map<string, number>()
  const pool = [...families.values()]
    .map((fam) => {
      const rep = fam.find((i) => i.wear === 'Field-Tested') ?? fam[Math.floor(fam.length / 2)]
      expected.set(rep.id, familyExpectedPrice(fam, dropCfg.wearWeights).toNumber())
      return rep
    })
    .sort((a, b) => expected.get(a.id)! - expected.get(b.id)!)
  const priceOf = (i: (typeof all)[number]) => expected.get(i.id) ?? Number(i.price)

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
  /** Up to `n` items spread evenly over the log-price range (cheapest and priciest included). */
  const spreadPick = <T,>(list: T[], n: number, price: (x: T) => number) => {
    const sorted = [...list].sort((x, y) => price(x) - price(y))
    if (sorted.length <= n) return sorted
    const lo = Math.log(price(sorted[0]))
    const hi = Math.log(price(sorted[sorted.length - 1]))
    const out = new Set<T>()
    for (let k = 0; k < n; k++) {
      const target = lo + ((hi - lo) * k) / (n - 1)
      const best = sorted.filter((x) => !out.has(x)).sort((x, y) => Math.abs(Math.log(price(x)) - target) - Math.abs(Math.log(price(y)) - target))[0]
      if (best) out.add(best)
    }
    return [...out]
  }
  /** Nice case price: …99 endings. */
  const nicePrice = (v: number) => (v >= 1000 ? Math.ceil(v / 100) * 100 - 1 : v >= 100 ? Math.ceil(v / 10) * 10 - 1 : Math.ceil(v))

  let order = 0
  for (const preset of CASE_PRESETS) {
    let list: (typeof pool)[number][]
    let price: number
    if (preset.knife || preset.theme) {
      // Knife / gloves cases hold ONLY ★ items (every finish of the model, spread by price) — no filler skins.
      const special = preset.knife
        ? pool.filter((i) => i.name.startsWith(`★ ${preset.knife} | `) || i.name === `★ ${preset.knife}`)
        : pool.filter((i) => (preset.theme === 'knives' ? isKnife(i.name) : isGloves(i.name)))
      list = spreadPick(special, preset.knife ? 18 : 24, priceOf)
      if (list.length < 3) continue
      // Price so that the cheapest item is ≈60% of the case: EV = price × RTP is then reachable
      // (cheap finishes drop most often, rare expensive ones pay out big).
      price = preset.price ?? nicePrice(Math.min(...list.map(priceOf)) / 0.6)
    } else {
      price = preset.price!
      const lo = price * 0.1
      const hi = price * 40
      const band = pool.filter((i) => priceOf(i) >= lo && priceOf(i) <= hi && !i.name.startsWith('★'))
      if (band.length < 4) continue
      const picked = new Map<string, (typeof band)[number]>()
      const weaponsUsed = new Set<string>()
      const want = Math.min(14, band.length)
      const bandLo = Math.max(lo, priceOf(band[0]))
      const bandHi = Math.max(...band.map((x) => priceOf(x)))
      for (let k = 0; k < want; k++) {
        const target = Math.exp(Math.log(bandLo) + ((Math.log(bandHi) - Math.log(bandLo)) * (k + 0.5)) / want)
        const sorted = [...band].sort((x, y) => Math.abs(Math.log(priceOf(x) / target)) - Math.abs(Math.log(priceOf(y) / target)))
        const choice = sorted.find((i) => !picked.has(i.id) && !weaponsUsed.has(i.name.split(' | ')[0])) ?? sorted.find((i) => !picked.has(i.id))
        if (!choice) continue
        picked.set(choice.id, choice)
        weaponsUsed.add(choice.name.split(' | ')[0])
      }
      // Guarantee at least 3 items cheaper than the case (otherwise EV/RTP cannot be met).
      const cheap = band.filter((i) => priceOf(i) < price && !picked.has(i.id))
      while ([...picked.values()].filter((i) => priceOf(i) < price).length < 3 && cheap.length) {
        const c = cheap.pop()!
        picked.set(c.id, c)
      }
      list = [...picked.values()]
    }
    if (!list.some((i) => priceOf(i) < price * rtp) || !list.some((i) => priceOf(i) > price * rtp)) continue
    const weights = weightsFor(list.map((i) => priceOf(i)), price, rtp)
    const total = weights.reduce((a, b) => a + b, 0)
    await db.transaction(async (tx) => {
      const [c] = await tx
        .insert(cases)
        .values({
          name: preset.name,
          slug: preset.slug,
          description: preset.description,
          image: `/assets/cases/${preset.slug}.svg`,
          price: price.toFixed(2),
          sortOrder: order++,
          isFeatured: preset.featured ?? false,
          badge: preset.badge ?? (preset.category === 'limited' ? 'limited' : null),
          endsAt: preset.endsInDays ? new Date(Date.now() + preset.endsInDays * 86_400_000) : null,
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
