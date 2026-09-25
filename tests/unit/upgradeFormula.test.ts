import { describe, expect, it } from 'vitest'
import { advanceBonusSchedule, bonusEdge, bonusEligible, bonusFrequency, bonusHit, computeChance, isWinningRoll, planBonus, ROLL_SCALE, type BonusSchedule, type UpgradeBonusConfig } from '@/server/services/upgradeFormula'
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
  const b: UpgradeBonusConfig = { enabled: true, minInterval: 6, maxInterval: 15, maxStake: 5000, zonePercent: 4, refundMinPercent: 30, refundMaxPercent: 50, doubleSharePercent: 50, doubleMaxMultiplier: 10 }
  // mulberry32 — deterministic, well-mixed
  const rng = (seed0: number) => {
    let seed = seed0
    return (n: number) => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n)
    }
  }

  it('places a 4% zone strictly inside the losing range, with a margin from the win arc', () => {
    const plan = planBonus(200_000, 5, b, (n) => n - 1)! // worst case: zone pushed to the far end
    expect(plan.size).toBe(40_000)
    expect(plan.start).toBeGreaterThanOrEqual(200_000 + ROLL_SCALE / 100)
    expect(plan.start + plan.size).toBeLessThanOrEqual(ROLL_SCALE - ROLL_SCALE / 100)
    expect(bonusHit(plan, plan.start)).toBe(true)
    expect(bonusHit(plan, plan.start + plan.size)).toBe(false)
    expect(planBonus(960_000, 1.05, b, () => 0)).toBeNull() // no room in the losing range
  })

  it('offers ×2 only up to doubleMaxMultiplier', () => {
    expect(planBonus(50_000, 20, b, () => 0)!.type).toBe('refund')
    expect(planBonus(200_000, 5, b, () => 0)!.type).toBe('double')
  })

  it('schedule: exactly one bonus per cycle of 6–15 upgrades', () => {
    const rand = rng(7)
    let s: BonusSchedule | null = null
    let sinceCycle = 0
    let bonusesInCycle = 0
    const lengths: number[] = []
    for (let i = 0; i < 20_000; i++) {
      const fresh = !s || s.cycleLeft <= 0
      if (fresh && i > 0) {
        expect(bonusesInCycle).toBe(1)
        lengths.push(sinceCycle)
        sinceCycle = 0
        bonusesInCycle = 0
      }
      const r = advanceBonusSchedule(s, b, rand)
      s = r.next
      sinceCycle++
      if (r.due) bonusesInCycle++
    }
    expect(Math.min(...lengths)).toBe(6)
    expect(Math.max(...lengths)).toBe(15)
    expect(bonusFrequency(b)).toBeCloseTo(1 / 10.5, 6)
  })

  it('no bonus (and no bonus edge) above maxStake or when disabled', () => {
    expect(bonusEligible(b, 5000)).toBe(true)
    expect(bonusEligible(b, 5000.01)).toBe(false)
    expect(bonusEligible({ ...b, enabled: false }, 10)).toBe(false)
    expect(bonusEdge(5, b, 6000)).toBe(0)
  })

  it('keeps the upgrade RTP: base win + bonus EV = 1 − houseEdge (Monte Carlo over the schedule)', () => {
    const cfg = { houseEdge: 0.08, minChance: 0.01, maxChance: 100 }
    for (const m of [2, 5, 10, 30]) {
      const S = 100
      const T = S * m
      const chance = computeChance(S, T, { ...cfg, houseEdge: cfg.houseEdge + bonusEdge(m, b, S) })
      const thr = chance.mul(ROLL_SCALE / 100).floor().toNumber()
      const rand = rng(12345 + m)
      let paid = 0
      let s: BonusSchedule | null = null
      const N = 600_000
      for (let i = 0; i < N; i++) {
        const roll = rand(ROLL_SCALE)
        const r = advanceBonusSchedule(s, b, rand)
        s = r.next
        const plan = r.due ? planBonus(thr, m, b, rand) : null
        if (roll < thr) paid += T
        else if (bonusHit(plan, roll)) paid += plan!.type === 'double' ? 2 * T : (S * plan!.refundPercent) / 100
      }
      expect(Math.abs(paid / (N * S) - 0.92), `m=${m}: ${paid / (N * S)}`).toBeLessThan(m > 10 ? 0.03 : 0.01)
    }
  })
})
