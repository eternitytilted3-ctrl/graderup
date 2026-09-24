import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, asc, eq, gt, sql, type SQL } from 'drizzle-orm'
import { D } from '@/lib/money'
import type { Rarity, UpgradeResultDTO } from '@/lib/types'
import { getDb } from '../db/client'
import { items, upgrades, userItems } from '../db/schema'
import { Errors } from '../http/errors'
import { secureRandomInt } from '../security/crypto'
import { applyBalanceChange, lockUser } from './ledger'
import { logEvent } from './log'
import { paginate, toItemDTO } from './mappers'
import { getSetting, type SettingValue } from './settings'
import { computeChance, isWinningRoll, ROLL_SCALE } from './upgradeFormula'

export { computeChance, isWinningRoll, ROLL_SCALE }

export type UpgradeConfig = SettingValue<'upgrade'>

/** Validates a source/target pair and returns the server-computed chance (for preview). */
export async function previewUpgrade(userId: string, userItemId: string, targetItemId: string) {
  const cfg = await getSetting('upgrade')
  const db = getDb()
  const [src] = await db
    .select({ ui: userItems, item: items })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(eq(userItems.id, userItemId), eq(userItems.userId, userId)))
  if (!src || src.ui.status !== 'available') throw Errors.notFound('Предмет не найден в инвентаре')
  const [target] = await db.select().from(items).where(and(eq(items.id, targetItemId), eq(items.isActive, true)))
  if (!target) throw Errors.notFound('Целевой предмет не найден')
  validatePair(src.item.price, target.price, cfg)
  const chance = computeChance(src.item.price, target.price, cfg)
  return {
    chance: chance.toFixed(2),
    sourceValue: src.item.price,
    targetValue: target.price,
    potentialWin: target.price,
    potentialLoss: src.item.price,
    multiplier: D(target.price).div(src.item.price).toDecimalPlaces(2).toString(),
  }
}

function validatePair(sourcePrice: string, targetPrice: string, cfg: UpgradeConfig) {
  const ratio = D(targetPrice).div(sourcePrice)
  if (ratio.lt(cfg.minMultiplier)) throw Errors.badRequest(`Целевой предмет должен быть дороже минимум в ${cfg.minMultiplier}×`)
  if (ratio.gt(cfg.maxMultiplier)) throw Errors.badRequest(`Целевой предмет может быть дороже максимум в ${cfg.maxMultiplier}×`)
}

/**
 * Performs an upgrade in a single DB transaction:
 * lock user → lock & verify source ownership/status → load target from DB → chance (config) →
 * crypto roll → consume source → (win) grant target → record upgrade + audit transaction.
 */
export async function performUpgrade(userId: string, userItemId: string, targetItemId: string, ip?: string): Promise<UpgradeResultDTO> {
  const cfg = await getSetting('upgrade')
  const db = getDb()
  const out = await db.transaction(async (tx) => {
    await lockUser(tx, userId)
    const [src] = await tx
      .select({ ui: userItems, item: items })
      .from(userItems)
      .innerJoin(items, eq(items.id, userItems.itemId))
      .where(and(eq(userItems.id, userItemId), eq(userItems.userId, userId)))
      .for('update', { of: userItems })
    if (!src) throw Errors.notFound('Предмет не найден в инвентаре')
    if (src.ui.status !== 'available') throw Errors.conflict('Предмет уже использован или продан', 'ITEM_UNAVAILABLE')

    const [target] = await tx.select().from(items).where(and(eq(items.id, targetItemId), eq(items.isActive, true)))
    if (!target) throw Errors.notFound('Целевой предмет не найден')
    validatePair(src.item.price, target.price, cfg)

    const chance = computeChance(src.item.price, target.price, cfg)
    const roll = secureRandomInt(ROLL_SCALE)
    const win = isWinningRoll(roll, chance)
    const upgradeId = randomUUID()

    const consumed = await tx
      .update(userItems)
      .set({ status: 'used', updatedAt: new Date() })
      .where(and(eq(userItems.id, src.ui.id), eq(userItems.status, 'available')))
      .returning({ id: userItems.id })
    if (consumed.length !== 1) throw Errors.conflict('Предмет уже использован', 'ITEM_UNAVAILABLE')

    let resultUserItemId: string | null = null
    if (win) {
      resultUserItemId = randomUUID()
      await tx.insert(userItems).values({ id: resultUserItemId, userId, itemId: target.id, source: 'upgrade', sourceReference: upgradeId })
    }
    await tx.insert(upgrades).values({
      id: upgradeId,
      userId,
      sourceUserItemId: src.ui.id,
      sourceItemId: src.item.id,
      targetItemId: target.id,
      resultUserItemId,
      sourceValue: src.item.price,
      targetValue: target.price,
      chance: chance.toFixed(4),
      roll,
      result: win ? 'win' : 'loss',
    })
    // Balance is not changed by an upgrade, but every operation is recorded in the ledger.
    await applyBalanceChange(tx, {
      userId,
      type: 'upgrade',
      amount: 0,
      referenceType: 'upgrade',
      referenceId: upgradeId,
      meta: {
        result: win ? 'win' : 'loss',
        chance: chance.toFixed(2),
        sourceItemName: src.item.name,
        sourceValue: src.item.price,
        targetItemName: target.name,
        targetValue: target.price,
        itemName: win ? target.name : src.item.name,
      },
    })
    return {
      upgradeId,
      result: win ? ('win' as const) : ('loss' as const),
      chance: chance.toFixed(2),
      roll,
      rollFraction: roll / ROLL_SCALE,
      source: toItemDTO(src.item),
      target: toItemDTO(target),
      resultUserItemId,
    }
  })
  void logEvent('upgrade', { userId, ip, details: { upgradeId: out.upgradeId, result: out.result, chance: out.chance, roll: out.roll } })
  return out
}

/** Catalogue of possible upgrade targets (active items), server-filtered by price. */
export async function listUpgradeTargets(opts: { minPrice?: string; search?: string; rarity?: Rarity; page: number; pageSize: number; sort?: 'price_asc' | 'price_desc' }) {
  const db = getDb()
  const conds: SQL[] = [eq(items.isActive, true)]
  if (opts.minPrice) conds.push(gt(items.price, opts.minPrice))
  if (opts.rarity) conds.push(eq(items.rarity, opts.rarity))
  if (opts.search) conds.push(sql`${items.name} ILIKE ${'%' + opts.search.replace(/[%_\\]/g, '\\$&') + '%'}`)
  const where = and(...conds)
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(items)
      .where(where)
      .orderBy(opts.sort === 'price_desc' ? sql`${items.price} desc` : asc(items.price))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(items).where(where),
  ])
  return paginate(rows.map((r) => toItemDTO(r)), total, opts.page, opts.pageSize)
}

export async function getUpgradeConfigPublic() {
  const cfg = await getSetting('upgrade')
  return { minMultiplier: cfg.minMultiplier, maxMultiplier: cfg.maxMultiplier, minChance: cfg.minChance, maxChance: cfg.maxChance }
}

export type AutoTargetMode = 'x2' | 'x5' | 'x10' | 'c30' | 'c50' | 'c75'

/**
 * Picks the active item whose price is closest to the desired target:
 * xN → source × N; cP → price that yields ≈P% chance with the current formula.
 */
export async function autoTarget(userId: string, userItemId: string, mode: AutoTargetMode) {
  const cfg = await getSetting('upgrade')
  const db = getDb()
  const [src] = await db
    .select({ ui: userItems, item: items })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(eq(userItems.id, userItemId), eq(userItems.userId, userId), eq(userItems.status, 'available')))
  if (!src) throw Errors.notFound('Предмет не найден в инвентаре')
  const s = D(src.item.price)
  const desired = mode.startsWith('x') ? s.mul(Number(mode.slice(1))) : s.mul(1 - cfg.houseEdge).mul(100).div(Number(mode.slice(1)))
  const min = s.mul(cfg.minMultiplier)
  const max = s.mul(cfg.maxMultiplier)
  const clamped = desired.lt(min) ? min : desired.gt(max) ? max : desired
  const [row] = await db
    .select()
    .from(items)
    .where(and(eq(items.isActive, true), sql`${items.price} >= ${min.toFixed(2)}`, sql`${items.price} <= ${max.toFixed(2)}`))
    .orderBy(sql`abs(${items.price} - ${clamped.toFixed(2)})`, asc(items.price))
    .limit(1)
  if (!row) throw Errors.notFound('Не найдено подходящей цели для этого предмета')
  return toItemDTO(row)
}
