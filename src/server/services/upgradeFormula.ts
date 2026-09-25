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
 * Once per cycle of `minInterval..maxInterval` upgrades (random length, bonus on a random spin inside
 * the cycle — so it is not predictable) an upgrade gets a bonus zone of `zonePercent` of the dial,
 * placed at a random spot of the LOSING part. If the (same, single) server roll lands in it:
 *   refund → the player gets `refundMin..refundMax`% of the stake back in coins (loses 50–70% instead of 100%);
 *   double → the target skin is granted twice (only offered up to `doubleMaxMultiplier`×).
 * Upgrades with a stake above `maxStake` neither advance the cycle nor get a zone.
 */
export interface UpgradeBonusConfig {
  enabled: boolean
  minInterval: number
  maxInterval: number
  maxStake: number
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

/** Per-user cycle state: spins left in the current cycle and spins until its bonus spin. */
export interface BonusSchedule {
  cycleLeft: number
  bonusIn: number
}

/** Distance kept between the bonus zone and the winning arc (1% of the dial). */
const BONUS_MARGIN = ROLL_SCALE / 100

const doubleAllowed = (multiplier: number, b: UpgradeBonusConfig) => multiplier <= b.doubleMaxMultiplier && b.doubleSharePercent > 0

export const bonusEligible = (b: UpgradeBonusConfig, stake: number) => b.enabled && b.maxInterval >= 1 && stake <= b.maxStake

/** Long-run share of eligible upgrades that get a zone: 1 / E[cycle length]. */
export const bonusFrequency = (b: UpgradeBonusConfig) => 2 / (Math.max(1, b.minInterval) + Math.max(1, b.maxInterval, b.minInterval))

/**
 * Expected bonus payout as a share of the stake. Added to the house edge so the bonus does not change
 * the upgrade RTP: chance = S/T × (1 − edge − bonusEdge) × 100. The displayed chance stays the exact
 * win probability; the bonus is paid from the difference.
 */
export function bonusEdge(multiplier: number, b: UpgradeBonusConfig, stake: number): number {
  if (!bonusEligible(b, stake)) return 0
  const hit = bonusFrequency(b) * (b.zonePercent / 100)
  const dShare = doubleAllowed(multiplier, b) ? b.doubleSharePercent / 100 : 0
  const refundAvg = (b.refundMinPercent + b.refundMaxPercent) / 200
  return hit * (dShare * 2 * multiplier + (1 - dShare) * refundAvg)
}

/** Advances the per-user cycle by one eligible upgrade; `due` = this upgrade gets the zone. */
export function advanceBonusSchedule(s: BonusSchedule | null, b: UpgradeBonusConfig, rand: (n: number) => number): { due: boolean; next: BonusSchedule } {
  let cur = s
  if (!cur || cur.cycleLeft <= 0) {
    const lo = Math.max(1, Math.min(b.minInterval, b.maxInterval))
    const hi = Math.max(lo, b.maxInterval)
    const len = lo + rand(hi - lo + 1)
    cur = { cycleLeft: len, bonusIn: 1 + rand(len) }
  }
  const next = { cycleLeft: cur.cycleLeft - 1, bonusIn: cur.bonusIn - 1 }
  return { due: next.bonusIn === 0, next }
}

/** Places a due bonus zone (server-side, before the roll is revealed). Null if the losing range is too small. */
export function planBonus(threshold: number, multiplier: number, b: UpgradeBonusConfig, rand: (n: number) => number): BonusPlan | null {
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
