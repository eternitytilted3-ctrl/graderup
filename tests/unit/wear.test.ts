import { describe, expect, it } from 'vitest'
import { familyExpectedPrice, rollWear } from '@/server/services/wear'

const W = { 'Factory New': 0.25, 'Minimal Wear': 22, 'Field-Tested': 42, 'Well-Worn': 6, 'Battle-Scarred': 29.75 }
const mk = (wear: string, price: string) => ({ id: wear, wear, price }) as never

describe('exterior roll', () => {
  const fam = [mk('Factory New', '1000'), mk('Minimal Wear', '300'), mk('Field-Tested', '200'), mk('Well-Worn', '150'), mk('Battle-Scarred', '120')]
  it('follows configured weights (FN rare, FT/BS/MW common)', () => {
    const n = 200_000
    const counts: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      const w = (rollWear(fam, W).item as unknown as { wear: string }).wear
      counts[w] = (counts[w] ?? 0) + 1
    }
    expect(counts['Factory New'] / n).toBeLessThan(0.005)
    expect(Math.abs(counts['Field-Tested'] / n - 0.42)).toBeLessThan(0.01)
    expect(counts['Battle-Scarred'] + counts['Minimal Wear'] + counts['Field-Tested']).toBeGreaterThan(n * 0.9)
  })
  it('renormalises when some exteriors do not exist; EV uses the same weights', () => {
    const two = [mk('Factory New', '100'), mk('Field-Tested', '10')]
    const ev = familyExpectedPrice(two, W).toNumber()
    expect(ev).toBeCloseTo((100 * 0.25 + 10 * 42) / 42.25, 6)
  })
})
