import { describe, expect, it } from 'vitest'
import { bonusEdge, bonusHit, computeChance, isWinningRoll, planBonus, ROLL_SCALE, type UpgradeBonusConfig } from '@/server/services/upgradeFormula'
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

describe('upgrade bonus zone', () => {
  const b: UpgradeBonusConfig = { enabled: true, chancePercent: 5, zonePercent: 4, refundMinPercent: 30, refundMaxPercent: 50, doubleSharePercent: 50, doubleMaxMultiplier: 10 }

  it('places a 4% zone strictly inside the losing range, with a margin from the win arc', () => {
    // rand(n) = n - 1 → worst case (zone pushed to the far end); force the 5% gate open with a first 0.
    const seq = [0]
    const plan = planBonus(200_000, 5, b, (n) => (seq.length ? seq.shift()! : n - 1))!
    expect(plan.size).toBe(40_000)
    expect(plan.start).toBeGreaterThanOrEqual(200_000 + ROLL_SCALE / 100)
    expect(plan.start + plan.size).toBeLessThanOrEqual(ROLL_SCALE - ROLL_SCALE / 100)
    expect(bonusHit(plan, plan.start)).toBe(true)
    expect(bonusHit(plan, plan.start + plan.size)).toBe(false)
  })

  it('appears only with the configured probability and never when disabled / no room', () => {
    expect(planBonus(200_000, 5, b, () => 500)).toBeNull() // 500 ≥ 5% of 10 000
    expect(planBonus(200_000, 5, { ...b, enabled: false }, () => 0)).toBeNull()
    expect(planBonus(960_000, 1.05, b, () => 0)).toBeNull()
  })

  it('offers ×2 only up to doubleMaxMultiplier', () => {
    expect(planBonus(50_000, 20, b, () => 0)!.type).toBe('refund')
    expect(planBonus(200_000, 5, b, () => 0)!.type).toBe('double')
  })

  it('keeps the upgrade RTP: base win + bonus EV = 1 − houseEdge (Monte Carlo)', () => {
    const cfg = { houseEdge: 0.08, minChance: 0.01, maxChance: 100 }
    for (const m of [2, 5, 10, 30]) {
      const S = 100
      const T = S * m
      const chance = computeChance(S, T, { ...cfg, houseEdge: cfg.houseEdge + bonusEdge(m, b) })
      const thr = chance.mul(ROLL_SCALE / 100).floor().toNumber()
      let paid = 0
      const N = 400_000
      // mulberry32 — deterministic, well-mixed
      let seed = 12345 + m
      const rand = (n: number) => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n)
      }
      for (let i = 0; i < N; i++) {
        const roll = rand(ROLL_SCALE)
        const plan = planBonus(thr, m, b, rand)
        if (roll < thr) paid += T
        else if (bonusHit(plan, roll)) paid += plan!.type === 'double' ? 2 * T : (S * plan!.refundPercent) / 100
      }
      expect(Math.abs(paid / (N * S) - 0.92), `m=${m}: ${paid / (N * S)}`).toBeLessThan(m > 10 ? 0.03 : 0.01)
    }
  })
})
