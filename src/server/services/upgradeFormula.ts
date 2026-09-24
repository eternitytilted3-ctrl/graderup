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
