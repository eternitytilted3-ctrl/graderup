import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { D, toMoney } from '@/lib/money'
import { RARITIES, type CaseDTO, type CaseItemDTO, type ItemDTO, type OpenCaseResult, type Rarity } from '@/lib/types'
import { getDb } from '../db/client'
import { caseItems, caseOpenings, cases, items, userItems, users } from '../db/schema'
import { Errors } from '../http/errors'
import { secureRandomInt } from '../security/crypto'
import { applyBalanceChange, lockUser } from './ledger'
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
  const entries = await loadCaseEntries(c.id)
  const totalWeight = entries.reduce((s, e) => s + e.ci.dropWeight, 0)
  const itemsOut: CaseItemDTO[] = entries.map((e) => ({
    ...toItemDTO(e.item),
    // Chance shown to users is computed from the SAME weights the RNG uses.
    chance: totalWeight > 0 ? D(e.ci.dropWeight).div(totalWeight).mul(100).toDecimalPlaces(4).toString() : '0',
  }))
  const topRarity = itemsOut.reduce<Rarity | undefined>(
    (best, i) => (!best || RARITIES.indexOf(i.rarity) > RARITIES.indexOf(best) ? i.rarity : best),
    undefined,
  )
  return { case: toCaseDTO(c, { itemCount: itemsOut.length, topRarity }), items: itemsOut }
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

/**
 * Opens a case. The whole operation is one DB transaction:
 * lock user → validate case (price from DB) → server RNG → debit → create item → record opening.
 * Nothing from the client except the case id is trusted.
 */
export async function openCase(userId: string, caseIdOrSlug: string, ip?: string): Promise<OpenCaseResult> {
  const db = getDb()
  const sellRatio = (await getSetting('inventory')).sellRatio
  const result = await db.transaction(async (tx) => {
    await lockUser(tx, userId)
    const [c] = await tx.select().from(cases).where(caseWhere(caseIdOrSlug))
    if (!c || c.status !== 'active') throw Errors.notFound('Кейс не найден или отключён')

    const entries = await tx
      .select({ ci: caseItems, item: items })
      .from(caseItems)
      .innerJoin(items, eq(items.id, caseItems.itemId))
      .where(and(eq(caseItems.caseId, c.id), eq(items.isActive, true)))
      .orderBy(asc(caseItems.id))
    if (entries.length === 0) throw Errors.conflict('Кейс временно недоступен', 'CASE_EMPTY')

    const totalWeight = entries.reduce((s, e) => s + e.ci.dropWeight, 0)
    const roll = secureRandomInt(totalWeight)
    const won = pickByWeight(entries.map((e) => ({ ...e, dropWeight: e.ci.dropWeight })), roll)

    const openingId = randomUUID()
    const userItemId = randomUUID()
    const { balanceAfter } = await applyBalanceChange(tx, {
      userId,
      type: 'case_open',
      amount: D(c.price).neg(),
      referenceType: 'case_opening',
      referenceId: openingId,
      meta: { caseId: c.id, caseName: c.name, itemId: won.item.id, itemName: won.item.name, itemPrice: won.item.price, rarity: won.item.rarity },
    })
    await tx.insert(userItems).values({ id: userItemId, userId, itemId: won.item.id, source: 'case', sourceReference: openingId })
    await tx.insert(caseOpenings).values({
      id: openingId,
      userId,
      caseId: c.id,
      itemId: won.item.id,
      userItemId,
      price: c.price,
      roll,
      totalWeight,
    })
    const winner = toItemDTO(won.item)
    return {
      openingId,
      userItemId,
      item: winner,
      reel: buildReel(entries, totalWeight, winner),
      winIndex: REEL_WIN_INDEX,
      balance: balanceAfter,
      sellPrice: toMoney(D(won.item.price).mul(sellRatio), 1),
      caseId: c.id,
      price: c.price,
    }
  })
  void logEvent('case_open', { userId, ip, details: { caseId: result.caseId, price: result.price, itemId: result.item.id, openingId: result.openingId } })
  const { caseId, price, ...out } = result
  void caseId
  void price
  return out
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
