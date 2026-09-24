import { describe, expect, it } from 'vitest'
import { formatMoney, toMoney } from '@/lib/money'
import { pickByWeight } from '@/server/services/cases'
import { rewardWindow } from '@/server/services/rewards'

describe('money', () => {
  it('uses decimal arithmetic (no float drift)', () => {
    expect(toMoney('0.1').toString()).toBe('0.10')
    expect(toMoney(0.1 + 0.2)).toBe('0.30')
    expect(formatMoney('1234567.5')).toBe('1\u202f234\u202f567.50\u00a0C')
    expect(formatMoney('49')).toBe('49\u00a0C')
    expect(formatMoney('-5')).toBe('\u22125\u00a0C')
  })
})

describe('weighted pick', () => {
  const entries = [
    { id: 'a', dropWeight: 1 },
    { id: 'b', dropWeight: 3 },
    { id: 'c', dropWeight: 6 },
  ]
  it('maps rolls to weight ranges', () => {
    expect(pickByWeight(entries, 0).id).toBe('a')
    expect(pickByWeight(entries, 1).id).toBe('b')
    expect(pickByWeight(entries, 3).id).toBe('b')
    expect(pickByWeight(entries, 4).id).toBe('c')
    expect(pickByWeight(entries, 9).id).toBe('c')
    expect(() => pickByWeight(entries, 10)).toThrow()
  })
})

describe('reward windows', () => {
  it('daily window changes at 00:00 UTC', () => {
    const a = rewardWindow('daily', 86400, Date.UTC(2026, 8, 24, 23, 59))
    const b = rewardWindow('daily', 86400, Date.UTC(2026, 8, 25, 0, 1))
    expect(a.periodKey).not.toBe(b.periodKey)
    expect(a.nextAt.toISOString()).toBe('2026-09-25T00:00:00.000Z')
  })
  it('weekly window starts on Monday', () => {
    const w = rewardWindow('weekly', 604800, Date.UTC(2026, 8, 24)) // Thursday
    expect(w.nextAt.getUTCDay()).toBe(1)
  })
})
