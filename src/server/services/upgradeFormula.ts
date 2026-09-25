import Decimal from 'decimal.js'
import { D, type MoneyInput } from '@/lib/money'

/** Roll space: integer in [0, 1_000_000). Chance of 12.3456% wins on roll < 123_456. */
export const ROLL_SCALE = 1_000_000

export interface UpgradeFormulaConfig {
  houseEdge: number
  minChance: number
  maxChance: number
}

/**
 * UpgradeService formula (pure, configurable via admin settings):
 *   chance% = clamp( sourceValue / targetValue × (1 − houseEdge) × 100, minChance, maxChance )
 * Rounded DOWN to 4 decimals so the displayed chance is never higher than the real one.
 */
export function computeChance(sourceValue: MoneyInput, targetValue: MoneyInput, cfg: UpgradeFormulaConfig): Decimal {
  const s = D(sourceValue)
  const t = D(targetValue)
  if (s.lte(0) || t.lte(0)) throw new Error('computeChance: values must be positive')
  const raw = s.div(t).mul(1 - cfg.houseEdge).mul(100)
  const clamped = Decimal.min(Decimal.max(raw, cfg.minChance), cfg.maxChance)
  return clamped.toDecimalPlaces(4, Decimal.ROUND_DOWN)
}

export function isWinningRoll(roll: number, chancePercent: Decimal): boolean {
  const threshold = chancePercent.mul(ROLL_SCALE / 100).floor().toNumber()
  return roll < threshold
}

// ─── Bonus zone ─────────────────────────────────────────────────────────────
/**
 * With `chancePercent` probability an upgrade gets a bonus zone of `zonePercent` of the dial, placed at a
 * random spot of the LOSING part. If the (same, single) server roll lands in it:
 *   refund → the player gets `refundMin..refundMax`% of the stake back in coins (loses 50–70% instead of 100%);
 *   double → the target skin is granted twice (only offered up to `doubleMaxMultiplier`×).
 */
export interface UpgradeBonusConfig {
  enabled: boolean
  chancePercent: number
  zonePercent: number
  refundMinPercent: number
  refundMaxPercent: number
  doubleSharePercent: number
  doubleMaxMultiplier: number
}

export type BonusType = 'refund' | 'double'

export interface BonusPlan {
  type: BonusType
  /** Zone in roll units: [start, start + size). Always inside the losing range. */
  start: number
  size: number
  /** Refund percent of the stake (refund only). */
  refundPercent: number
}

/** Distance kept between the bonus zone and the winning arc (1% of the dial). */
const BONUS_MARGIN = ROLL_SCALE / 100

const doubleAllowed = (multiplier: number, b: UpgradeBonusConfig) => multiplier <= b.doubleMaxMultiplier && b.doubleSharePercent > 0

/**
 * Expected bonus payout as a share of the stake. Added to the house edge so the bonus does not change
 * the upgrade RTP: chance = S/T × (1 − edge − bonusEdge) × 100. The displayed chance stays the exact
 * win probability; the bonus is paid from the difference.
 */
export function bonusEdge(multiplier: number, b: UpgradeBonusConfig): number {
  if (!b.enabled || b.chancePercent <= 0) return 0
  const hit = (b.chancePercent / 100) * (b.zonePercent / 100)
  const dShare = doubleAllowed(multiplier, b) ? b.doubleSharePercent / 100 : 0
  const refundAvg = (b.refundMinPercent + b.refundMaxPercent) / 200
  return hit * (dShare * 2 * multiplier + (1 - dShare) * refundAvg)
}

/** Decides (server-side, before the roll is revealed) whether this upgrade gets a bonus zone and where. */
export function planBonus(threshold: number, multiplier: number, b: UpgradeBonusConfig, rand: (n: number) => number): BonusPlan | null {
  if (!b.enabled || rand(10_000) >= Math.round(b.chancePercent * 100)) return null
  const size = Math.round((b.zonePercent / 100) * ROLL_SCALE)
  const free = ROLL_SCALE - threshold - 2 * BONUS_MARGIN - size
  if (size <= 0 || free < 0) return null
  const start = threshold + BONUS_MARGIN + rand(free + 1)
  const type: BonusType = doubleAllowed(multiplier, b) && rand(100) < b.doubleSharePercent ? 'double' : 'refund'
  const lo = Math.min(b.refundMinPercent, b.refundMaxPercent)
  const hi = Math.max(b.refundMinPercent, b.refundMaxPercent)
  return { type, start, size, refundPercent: lo + rand(hi - lo + 1) }
}

export const bonusHit = (plan: BonusPlan | null, roll: number) => plan !== null && roll >= plan.start && roll < plan.start + plan.size
