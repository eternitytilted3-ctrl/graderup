import { describe, expect, it } from 'vitest'
import { computeChance, isWinningRoll, ROLL_SCALE } from '@/server/services/upgradeFormula'
import { D } from '@/lib/money'

const cfg = { houseEdge: 0.08, minChance: 1, maxChance: 80 }

describe('upgrade formula', () => {
  it('computes ratio × (1 − edge) in percent, rounded down', () => {
    expect(computeChance('10.00', '20.00', cfg).toString()).toBe('46')
    expect(computeChance('1', '3', cfg).toFixed(4)).toBe('30.6666')
  })
  it('clamps to min/max chance', () => {
    expect(computeChance('1', '1000', cfg).toString()).toBe('1')
    expect(computeChance('99', '100', cfg).toString()).toBe('80')
  })
  it('rejects non-positive values', () => {
    expect(() => computeChance('0', '10', cfg)).toThrow()
  })
  it('win iff roll < chance × 10_000', () => {
    const c = D('12.3456')
    expect(isWinningRoll(123_455, c)).toBe(true)
    expect(isWinningRoll(123_456, c)).toBe(false)
    expect(isWinningRoll(0, D('0.0001'))).toBe(true)
    expect(isWinningRoll(ROLL_SCALE - 1, D('80'))).toBe(false)
  })
  it('empirical win rate matches chance', () => {
    const c = D('37.5')
    let wins = 0
    const n = 200_000
    for (let i = 0; i < n; i++) if (isWinningRoll(Math.floor(Math.random() * ROLL_SCALE), c)) wins++
    expect(Math.abs(wins / n - 0.375)).toBeLessThan(0.01)
  })
})
