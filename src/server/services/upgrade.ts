import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, asc, eq, gt, inArray, sql, type SQL } from 'drizzle-orm'
import Decimal from 'decimal.js'
import { D, toMoney } from '@/lib/money'
import type { Rarity, UpgradeResultDTO } from '@/lib/types'
import { getDb, type Executor } from '../db/client'
import { items, upgradeSources, upgrades, userItems } from '../db/schema'
import { Errors } from '../http/errors'
import { secureRandomInt } from '../security/crypto'
import { applyBalanceChange, lockUser } from './ledger'
import { logEvent } from './log'
import { paginate, toItemDTO } from './mappers'
import { getSetting, type SettingValue } from './settings'
import { bonusEdge, bonusHit, computeChance, isWinningRoll, planBonus, ROLL_SCALE } from './upgradeFormula'

export { computeChance, isWinningRoll, ROLL_SCALE }

export type UpgradeConfig = SettingValue<'upgrade'>
type BonusConfig = SettingValue<'upgradeBonus'>

/** Win chance with the bonus-zone EV folded into the edge (keeps the upgrade RTP unchanged). */
function upgradeChance(sourceValue: string, targetPrice: string, cfg: UpgradeConfig, bonus: BonusConfig) {
  const multiplier = D(targetPrice).div(sourceValue).toNumber()
  return computeChance(sourceValue, targetPrice, { ...cfg, houseEdge: cfg.houseEdge + bonusEdge(multiplier, bonus) })
}

export const MAX_UPGRADE_SOURCES = 5

function normalizeIds(ids: string[]) {
  const unique = [...new Set(ids)]
  if (unique.length === 0 || unique.length > MAX_UPGRADE_SOURCES) throw Errors.badRequest(`Выберите от 1 до ${MAX_UPGRADE_SOURCES} предметов`)
  if (unique.length !== ids.length) throw Errors.badRequest('Предметы не должны повторяться')
  return unique
}

/** Loads the caller's source items (optionally row-locked). All must exist, be owned and available. */
async function loadSources(ex: Executor, userId: string, ids: string[], lock: boolean) {
  const q = ex
    .select({ ui: userItems, item: items })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(inArray(userItems.id, ids), eq(userItems.userId, userId)))
    .orderBy(asc(userItems.id)) // deterministic lock order
  const rows = lock ? await q.for('update', { of: userItems }) : await q
  if (rows.length !== ids.length) throw Errors.notFound('Предмет не найден в инвентаре')
  if (rows.some((r) => r.ui.status !== 'available')) throw Errors.conflict('Предмет уже использован или продан', 'ITEM_UNAVAILABLE')
  const value = rows.reduce((sum, r) => sum.plus(r.item.price), D(0))
  return { rows, value: value.toFixed(2) }
}

/** Validates sources/target and returns the server-computed chance (for preview). */
export async function previewUpgrade(userId: string, userItemIds: string[], targetItemId: string) {
  const [cfg, bonusCfg] = await Promise.all([getSetting('upgrade'), getSetting('upgradeBonus')])
  const db = getDb()
  const { value } = await loadSources(db, userId, normalizeIds(userItemIds), false)
  const [target] = await db.select().from(items).where(and(eq(items.id, targetItemId), eq(items.isActive, true)))
  if (!target) throw Errors.notFound('Целевой предмет не найден')
  validatePair(value, target.price, cfg)
  const chance = upgradeChance(value, target.price, cfg, bonusCfg)
  return {
    chance: chance.toFixed(2),
    sourceValue: value,
    targetValue: target.price,
    potentialWin: target.price,
    potentialLoss: value,
    multiplier: D(target.price).div(value).toDecimalPlaces(2).toString(),
  }
}

function validatePair(sourceValue: string, targetPrice: string, cfg: UpgradeConfig) {
  const ratio = D(targetPrice).div(sourceValue)
  if (ratio.lt(cfg.minMultiplier)) throw Errors.badRequest(`Целевой предмет должен быть дороже минимум в ${cfg.minMultiplier}×`)
  if (ratio.gt(cfg.maxMultiplier)) throw Errors.badRequest(`Целевой предмет может быть дороже максимум в ${cfg.maxMultiplier}×`)
}

/**
 * Performs an upgrade of 1..5 source items in a single DB transaction:
 * lock user → lock & verify all sources (owned, available) → target from DB → chance on the SUM →
 * crypto roll → consume all sources → (win) grant target → upgrade + upgrade_sources + ledger.
 */
export async function performUpgrade(userId: string, userItemIds: string[], targetItemId: string, ip?: string): Promise<UpgradeResultDTO> {
  const [cfg, bonusCfg] = await Promise.all([getSetting('upgrade'), getSetting('upgradeBonus')])
  const ids = normalizeIds(userItemIds)
  const db = getDb()
  const out = await db.transaction(async (tx) => {
    await lockUser(tx, userId)
    const { rows, value } = await loadSources(tx, userId, ids, true)

    const [target] = await tx.select().from(items).where(and(eq(items.id, targetItemId), eq(items.isActive, true)))
    if (!target) throw Errors.notFound('Целевой предмет не найден')
    validatePair(value, target.price, cfg)

    const chance = upgradeChance(value, target.price, cfg, bonusCfg)
    const roll = secureRandomInt(ROLL_SCALE)
    const baseWin = isWinningRoll(roll, chance)
    // Bonus zone: decided together with the roll, always inside the losing range.
    const threshold = chance.mul(ROLL_SCALE / 100).floor().toNumber()
    const plan = planBonus(threshold, D(target.price).div(value).toNumber(), bonusCfg, secureRandomInt)
    const hit = !baseWin && bonusHit(plan, roll)
    const double = hit && plan!.type === 'double'
    const refund = hit && plan!.type === 'refund' ? toMoney(D(value).mul(plan!.refundPercent).div(100), Decimal.ROUND_DOWN) : null
    const win = baseWin || double
    const upgradeId = randomUUID()

    const consumed = await tx
      .update(userItems)
      .set({ status: 'used', updatedAt: new Date() })
      .where(and(inArray(userItems.id, ids), eq(userItems.userId, userId), eq(userItems.status, 'available')))
      .returning({ id: userItems.id })
    if (consumed.length !== ids.length) throw Errors.conflict('Предмет уже использован', 'ITEM_UNAVAILABLE')

    let resultUserItemId: string | null = null
    let extraUserItemId: string | null = null
    if (win) {
      resultUserItemId = randomUUID()
      await tx.insert(userItems).values({ id: resultUserItemId, userId, itemId: target.id, source: 'upgrade', sourceReference: upgradeId })
    }
    if (double) {
      extraUserItemId = randomUUID()
      await tx.insert(userItems).values({ id: extraUserItemId, userId, itemId: target.id, source: 'upgrade', sourceReference: upgradeId })
    }
    await tx.insert(upgrades).values({
      id: upgradeId,
      userId,
      sourceUserItemId: rows[0].ui.id,
      sourceItemId: rows[0].item.id,
      targetItemId: target.id,
      resultUserItemId,
      sourceValue: value,
      targetValue: target.price,
      chance: chance.toFixed(4),
      roll,
      result: win ? 'win' : 'loss',
      bonusType: plan?.type ?? null,
      bonusZoneStart: plan?.start ?? null,
      bonusZoneSize: plan?.size ?? null,
      bonusHit: hit,
      bonusPayout: refund,
    })
    await tx.insert(upgradeSources).values(rows.map((r) => ({ upgradeId, userItemId: r.ui.id, itemId: r.item.id, value: r.item.price })))
    const sourceNames = rows.map((r) => r.item.name)
    // Balance changes only on a refund-zone hit; every upgrade is still recorded in the ledger.
    await applyBalanceChange(tx, {
      userId,
      type: 'upgrade',
      amount: refund ?? 0,
      referenceType: 'upgrade',
      referenceId: upgradeId,
      meta: {
        result: win ? 'win' : 'loss',
        chance: chance.toFixed(2),
        sourceItemName: sourceNames.length > 1 ? `${sourceNames.length} предм.` : sourceNames[0],
        sourceItems: sourceNames,
        sourceValue: value,
        targetItemName: target.name,
        targetValue: target.price,
        itemName: win ? target.name : sourceNames.join(', '),
        ...(plan ? { bonus: plan.type, bonusHit: hit, bonusPayout: refund } : {}),
      },
    })
    return {
      upgradeId,
      result: win ? ('win' as const) : ('loss' as const),
      chance: chance.toFixed(2),
      roll,
      rollFraction: roll / ROLL_SCALE,
      sources: rows.map((r) => toItemDTO(r.item)),
      sourceValue: value,
      target: toItemDTO(target),
      resultUserItemId,
      bonus: plan
        ? { type: plan.type, start: plan.start / ROLL_SCALE, size: plan.size / ROLL_SCALE, hit, refund, extraUserItemId }
        : null,
    }
  })
  void logEvent('upgrade', { userId, ip, details: { upgradeId: out.upgradeId, result: out.result, chance: out.chance, roll: out.roll, sources: ids, bonus: out.bonus?.type ?? null, bonusHit: out.bonus?.hit ?? false } })
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
  const [cfg, b] = await Promise.all([getSetting('upgrade'), getSetting('upgradeBonus')])
  return {
    minMultiplier: cfg.minMultiplier,
    maxMultiplier: cfg.maxMultiplier,
    minChance: cfg.minChance,
    maxChance: cfg.maxChance,
    bonus: b.enabled && b.chancePercent > 0 ? { chancePercent: b.chancePercent, zonePercent: b.zonePercent, refundMinPercent: b.refundMinPercent, refundMaxPercent: b.refundMaxPercent, doubleMaxMultiplier: b.doubleMaxMultiplier } : null,
  }
}

export type AutoTargetMode = 'x2' | 'x5' | 'x10' | 'c30' | 'c50' | 'c75'

/**
 * Picks the active item whose price is closest to the desired target:
 * xN → source × N; cP → price that yields ≈P% chance with the current formula.
 */
export async function autoTarget(userId: string, userItemIds: string[], mode: AutoTargetMode) {
  const [cfg, bonusCfg] = await Promise.all([getSetting('upgrade'), getSetting('upgradeBonus')])
  const db = getDb()
  const { value } = await loadSources(db, userId, normalizeIds(userItemIds), false)
  const src = D(value)
  const pct = Number(mode.slice(1))
  const edge = mode.startsWith('x') ? 0 : cfg.houseEdge + bonusEdge(((1 - cfg.houseEdge) * 100) / pct, bonusCfg)
  const desired = mode.startsWith('x') ? src.mul(pct) : src.mul(1 - edge).mul(100).div(pct)
  const min = src.mul(cfg.minMultiplier)
  const max = src.mul(cfg.maxMultiplier)
  const clamped = desired.lt(min) ? min : desired.gt(max) ? max : desired
  const [row] = await db
    .select()
    .from(items)
    .where(and(eq(items.isActive, true), sql`${items.price} >= ${min.toFixed(2)}`, sql`${items.price} <= ${max.toFixed(2)}`))
    .orderBy(sql`abs(${items.price} - ${clamped.toFixed(2)})`, asc(items.price))
    .limit(1)
  if (!row) throw Errors.notFound('Не найдено подходящей цели для выбранных предметов')
  return toItemDTO(row)
}
