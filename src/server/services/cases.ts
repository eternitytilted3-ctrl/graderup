import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { D, toMoney } from '@/lib/money'
import { RARITIES, type CaseCategoryDTO, type CaseDTO, type CaseItemDTO, type ItemDTO, type OpenCaseDrop, type OpenCaseResult, type OpenCasesResult, type Rarity } from '@/lib/types'
import { getDb } from '../db/client'
import { caseCategories, caseItems, caseOpenings, cases, items, userItems, users } from '../db/schema'
import { Errors } from '../http/errors'
import { secureRandomInt } from '../security/crypto'
import { applyBalanceChange, lockUser } from './ledger'
import { loadFamilies, rollWear } from './wear'
import { logEvent } from './log'
import { toItemDTO } from './mappers'
import { getSetting } from './settings'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const REEL_LENGTH = 56
export const REEL_WIN_INDEX = 48

function caseWhere(idOrSlug: string) {
  return UUID_RE.test(idOrSlug) ? eq(cases.id, idOrSlug) : eq(cases.slug, idOrSlug.toLowerCase())
}

function toCaseDTO(c: typeof cases.$inferSelect, extra: Partial<CaseDTO> = {}): CaseDTO {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    price: c.price,
    status: c.status,
    isFeatured: c.isFeatured,
    categoryId: c.categoryId,
    ...extra,
  }
}

export async function listCases(opts: { includeDisabled?: boolean } = {}): Promise<CaseDTO[]> {
  const db = getDb()
  const rows = await db
    .select({
      c: cases,
      itemCount: sql<number>`count(${caseItems.id})::int`,
      topRarity: sql<Rarity | null>`max(${items.rarity})::text`,
    })
    .from(cases)
    .leftJoin(caseItems, eq(caseItems.caseId, cases.id))
    .leftJoin(items, eq(items.id, caseItems.itemId))
    .where(opts.includeDisabled ? undefined : eq(cases.status, 'active'))
    .groupBy(cases.id)
    .orderBy(asc(cases.sortOrder), asc(cases.price))
  return rows.map((r) => toCaseDTO(r.c, { itemCount: r.itemCount, topRarity: r.topRarity ?? undefined }))
}

/** Cases grouped into active categories (catalogue sections); uncategorised cases go last. */
export async function listCaseCatalog(): Promise<{ category: CaseCategoryDTO; cases: CaseDTO[] }[]> {
  const [all, cats] = await Promise.all([
    listCases(),
    getDb().select().from(caseCategories).where(eq(caseCategories.isActive, true)).orderBy(asc(caseCategories.sortOrder), asc(caseCategories.name)),
  ])
  const sections = cats.map((c) => ({ category: { id: c.id, name: c.name, slug: c.slug }, cases: all.filter((x) => x.categoryId === c.id) }))
  const known = new Set(cats.map((c) => c.id))
  const rest = all.filter((x) => !x.categoryId || !known.has(x.categoryId))
  if (rest.length) sections.push({ category: { id: 'other', name: 'Другие', slug: 'other' }, cases: rest })
  return sections.filter((s) => s.cases.length > 0)
}

/** Pure weighted pick — exported for tests. `roll` must be in [0, totalWeight). */
export function pickByWeight<T extends { dropWeight: number }>(entries: T[], roll: number): T {
  let acc = 0
  for (const e of entries) {
    acc += e.dropWeight
    if (roll < acc) return e
  }
  throw new Error('pickByWeight: roll out of range')
}

async function loadCaseEntries(caseId: string) {
  return getDb()
    .select({ ci: caseItems, item: items })
    .from(caseItems)
    .innerJoin(items, eq(items.id, caseItems.itemId))
    .where(and(eq(caseItems.caseId, caseId), eq(items.isActive, true)))
    .orderBy(desc(items.price))
}

export async function getCase(idOrSlug: string, opts: { includeDisabled?: boolean } = {}) {
  const db = getDb()
  const [c] = await db.select().from(cases).where(caseWhere(idOrSlug))
  if (!c || (c.status !== 'active' && !opts.includeDisabled)) throw Errors.notFound('Кейс не найден')
  const [entries, casesCfg] = await Promise.all([loadCaseEntries(c.id), getSetting('cases')])
  const totalWeight = entries.reduce((s, e) => s + e.ci.dropWeight, 0)
  const itemsOut: CaseItemDTO[] = entries.map((e) => {
    const base = toItemDTO(e.item)
    if (!casesCfg.showOdds) {
      // Odds, prices and exterior are hidden: players see the skin, the exterior is rolled on drop.
      return { id: base.id, name: e.item.baseName ?? base.name, image: base.image, rarity: base.rarity, price: '', chance: '' }
    }
    return { ...base, chance: totalWeight > 0 ? D(e.ci.dropWeight).div(totalWeight).mul(100).toDecimalPlaces(4).toString() : '0' }
  })
  const topRarity = itemsOut.reduce<Rarity | undefined>(
    (best, i) => (!best || RARITIES.indexOf(i.rarity) > RARITIES.indexOf(best) ? i.rarity : best),
    undefined,
  )
  return { case: toCaseDTO(c, { itemCount: itemsOut.length, topRarity }), items: itemsOut, showOdds: casesCfg.showOdds }
}

/** Decorative reel around the (already determined) winning item. Visualization only. */
function buildReel(entries: { ci: { dropWeight: number }; item: typeof items.$inferSelect }[], totalWeight: number, winner: ItemDTO) {
  const reel: ItemDTO[] = []
  for (let i = 0; i < REEL_LENGTH; i++) {
    if (i === REEL_WIN_INDEX) reel.push(winner)
    else reel.push(toItemDTO(pickByWeight(entries.map((e) => ({ ...e, dropWeight: e.ci.dropWeight })), secureRandomInt(totalWeight)).item))
  }
  return reel
}

export const MAX_OPEN_COUNT = 5

/**
 * Opens `count` (1..5) cases in ONE DB transaction:
 * lock user → validate case (price from DB) → N independent server RNG rolls →
 * N debits (one ledger row per case) → N items → N openings. All-or-nothing.
 * Nothing from the client except the case id and count is trusted.
 */
export async function openCases(userId: string, caseIdOrSlug: string, count = 1, ip?: string): Promise<OpenCasesResult> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_OPEN_COUNT) throw Errors.badRequest(`Можно открыть от 1 до ${MAX_OPEN_COUNT} кейсов`)
  const db = getDb()
  const [{ sellRatio }, dropCfg] = await Promise.all([getSetting('inventory'), getSetting('drops')])
  const out = await db.transaction(async (tx) => {
    const user = await lockUser(tx, userId)
    const [c] = await tx.select().from(cases).where(caseWhere(caseIdOrSlug))
    if (!c || c.status !== 'active') throw Errors.notFound('Кейс не найден или отключён')
    // Early check for a clearer error; the ledger re-checks under the same lock.
    if (D(user.balance).lt(D(c.price).mul(count))) throw Errors.insufficientFunds()

    const entries = await tx
      .select({ ci: caseItems, item: items })
      .from(caseItems)
      .innerJoin(items, eq(items.id, caseItems.itemId))
      .where(and(eq(caseItems.caseId, c.id), eq(items.isActive, true)))
      .orderBy(asc(caseItems.id))
    if (entries.length === 0) throw Errors.conflict('Кейс временно недоступен', 'CASE_EMPTY')
    const weighted = entries.map((e) => ({ ...e, dropWeight: e.ci.dropWeight }))
    const totalWeight = entries.reduce((s, e) => s + e.ci.dropWeight, 0)
    const familyOf = await loadFamilies(tx, entries.map((e) => e.item))

    const drops: OpenCaseDrop[] = []
    let balance = user.balance
    for (let n = 0; n < count; n++) {
      // 1) which skin (case weights), 2) which exterior (wear weights) — both server-side.
      const roll = secureRandomInt(totalWeight)
      const skin = pickByWeight(weighted, roll)
      const won = { item: rollWear(familyOf(skin.item), dropCfg.wearWeights).item }
      const openingId = randomUUID()
      const userItemId = randomUUID()
      const r = await applyBalanceChange(tx, {
        userId,
        type: 'case_open',
        amount: D(c.price).neg(),
        referenceType: 'case_opening',
        referenceId: openingId,
        meta: { caseId: c.id, caseName: c.name, itemId: won.item.id, itemName: won.item.name, itemPrice: won.item.price, rarity: won.item.rarity },
      })
      balance = r.balanceAfter
      await tx.insert(userItems).values({ id: userItemId, userId, itemId: won.item.id, source: 'case', sourceReference: openingId })
      await tx.insert(caseOpenings).values({ id: openingId, userId, caseId: c.id, itemId: won.item.id, userItemId, price: c.price, roll, totalWeight })
      const winner = toItemDTO(won.item)
      drops.push({
        openingId,
        userItemId,
        item: winner,
        reel: buildReel(entries, totalWeight, winner),
        winIndex: REEL_WIN_INDEX,
        sellPrice: toMoney(D(won.item.price).mul(sellRatio), 1),
      })
    }
    return { results: drops, balance, caseId: c.id, price: c.price }
  })
  void logEvent('case_open', {
    userId,
    ip,
    details: { caseId: out.caseId, price: out.price, count, items: out.results.map((r) => r.item.id), openings: out.results.map((r) => r.openingId) },
  })
  return { results: out.results, balance: out.balance }
}

/** Single-case convenience wrapper (used by seed/tests). */
export async function openCase(userId: string, caseIdOrSlug: string, ip?: string): Promise<OpenCaseResult> {
  const r = await openCases(userId, caseIdOrSlug, 1, ip)
  return { ...r.results[0], balance: r.balance }
}

/** Public feed of recent drops (usernames only). */
export async function recentDrops(limit = 20) {
  const db = getDb()
  const rows = await db
    .select({ id: caseOpenings.id, createdAt: caseOpenings.createdAt, item: items, username: users.username, caseName: cases.name, caseSlug: cases.slug })
    .from(caseOpenings)
    .innerJoin(items, eq(items.id, caseOpenings.itemId))
    .innerJoin(users, eq(users.id, caseOpenings.userId))
    .innerJoin(cases, eq(cases.id, caseOpenings.caseId))
    .orderBy(desc(caseOpenings.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    username: r.username,
    caseName: r.caseName,
    caseSlug: r.caseSlug,
    item: toItemDTO(r.item),
  }))
}
