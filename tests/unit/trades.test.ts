import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarketCsgoTradeProvider } from '@/server/trades/MarketCsgoTradeProvider'

const p = new MarketCsgoTradeProvider({ apiKey: 'KEY', apiUrl: 'https://market.test/api/v2', maxOverpayPercent: 10 })
const TRADE = 'https://steamcommunity.com/tradeoffer/new/?partner=123456&token=AbC_d-9'

describe('market.csgo.com buy-for delivery', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('buys for the player trade URL with a capped price in kopecks and our withdrawal id', async () => {
    const fetchMock = vi.fn(async (url: string) => url && Response.json({ success: true, id: '777', price: 12000 }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await p.requestWithdrawal({ withdrawalId: 'w-1', marketHashName: 'AK-47 | Redline (Field-Tested)', maxPrice: '2450.50', tradeUrl: TRADE })
    expect(r.externalId).toBe('w-1')
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/api/v2/buy-for')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ key: 'KEY', hash_name: 'AK-47 | Redline (Field-Tested)', price: '269555', partner: '123456', token: 'AbC_d-9', custom_id: 'w-1' })
  })

  it('surfaces marketplace errors (item returns to inventory upstream)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false, error: 'No offers' })))
    await expect(p.requestWithdrawal({ withdrawalId: 'w-2', marketHashName: 'X', maxPrice: '10', tradeUrl: TRADE })).rejects.toThrow(/No offers/)
  })

  it('maps purchase stages to withdrawal statuses', async () => {
    const reply = (data: object) => vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true, data })))
    reply({ stage: '1' })
    expect((await p.getStatus('w-1')).status).toBe('searching')
    reply({ stage: 1, trade_id: '5550001' })
    expect(await p.getStatus('w-1')).toMatchObject({ status: 'waiting_accept', tradeOfferId: '5550001' })
    reply({ stage: '2' })
    expect((await p.getStatus('w-1')).status).toBe('completed')
    reply({ stage: '5' })
    expect((await p.getStatus('w-1')).status).toBe('failed')
  })
})
