import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatLeft } from '@/components/domain/Countdown'
import { ChainPriceProvider } from '@/server/pricing/ChainPriceProvider'
import { estimateRubPrice } from '@/server/pricing/estimate'
import { MarketCsgoPriceProvider } from '@/server/pricing/MarketCsgoPriceProvider'
import type { PriceProvider } from '@/server/pricing/PriceProvider'

const est = (name: string, rarity: Parameters<typeof estimateRubPrice>[0]['rarity'], weapon: string, pattern: string | null, wear: string | null) =>
  estimateRubPrice({ marketHashName: wear ? `${name} (${wear})` : name, rarity, weapon, pattern, wear })

describe('offline RUB estimate', () => {
  it('keeps iconic, cheap and knife skins in realistic bands', () => {
    expect(est('AWP | Dragon Lore', 'mythic', 'AWP', 'Dragon Lore', 'Field-Tested')).toBeGreaterThan(300_000)
    expect(est('P250 | Sand Dune', 'common', 'P250', 'Sand Dune', 'Field-Tested')).toBeLessThan(20)
    const gutMesh = est('★ Gut Knife | Safari Mesh', 'mythic', 'Gut Knife', 'Safari Mesh', 'Field-Tested')
    expect(gutMesh).toBeGreaterThan(3000)
    expect(gutMesh).toBeLessThan(8000)
    expect(est('★ Karambit | Fade', 'mythic', 'Karambit', 'Fade', 'Factory New')).toBeGreaterThan(gutMesh * 10)
  })
  it('orders exteriors and is deterministic', () => {
    const fn = est('AK-47 | Slate', 'epic', 'AK-47', 'Slate', 'Factory New')
    const bs = est('AK-47 | Slate', 'epic', 'AK-47', 'Slate', 'Battle-Scarred')
    expect(fn).toBeGreaterThan(bs)
    expect(est('AK-47 | Slate', 'epic', 'AK-47', 'Slate', 'Factory New')).toBe(fn)
  })
})

describe('market.csgo.com provider', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('parses the RUB price list and skips unknown / zero rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          currency: 'RUB',
          items: [
            { market_hash_name: 'AK-47 | Redline (Field-Tested)', price: '2450.5', volume: '120' },
            { market_hash_name: 'Unknown', price: '1', volume: '1' },
            { market_hash_name: 'P250 | Sand Dune (Field-Tested)', price: '0', volume: '5' },
          ],
        }),
      ),
    )
    const m = await new MarketCsgoPriceProvider().fetchPrices(['AK-47 | Redline (Field-Tested)', 'P250 | Sand Dune (Field-Tested)'])
    expect([...m.keys()]).toEqual(['AK-47 | Redline (Field-Tested)'])
    expect(m.get('AK-47 | Redline (Field-Tested)')).toMatchObject({ price: '2450.50', currency: 'RUB' })
  })
})

describe('price chain', () => {
  const fixed = (id: string, prices: Record<string, string>, fail = false): PriceProvider => ({
    id,
    async fetchPrices(names) {
      if (fail) throw new Error('down')
      return new Map(names.filter((n) => prices[n]).map((n) => [n, { marketHashName: n, price: prices[n], currency: 'RUB' }]))
    },
  })
  it('uses the first source and fills gaps from the next; failures are skipped', async () => {
    const chain = new ChainPriceProvider([fixed('broken', {}, true), fixed('a', { x: '10.00' }), fixed('b', { x: '99.00', y: '20.00' })])
    const m = await chain.fetchPrices(['x', 'y', 'z'])
    expect(m.get('x')?.price).toBe('10.00')
    expect(m.get('y')?.price).toBe('20.00')
    expect(m.has('z')).toBe(false)
    expect(chain.sources.get('x')).toBe('a')
    expect(chain.sources.get('y')).toBe('b')
    expect(chain.errors[0]).toMatch(/broken/)
  })
})

describe('limited case countdown', () => {
  it('formats days / last-day / ended', () => {
    expect(formatLeft(((20 * 24 + 13) * 60 + 58) * 60_000 + 5_000)).toBe('20Д:13Ч:58М')
    expect(formatLeft((2 * 3600 + 5 * 60 + 7) * 1000)).toBe('02Ч:05М:07С')
    expect(formatLeft(0)).toBe('Завершён')
  })
})
