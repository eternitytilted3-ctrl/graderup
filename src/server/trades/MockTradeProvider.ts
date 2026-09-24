import type { TradeProvider, TradeState } from './TradeProvider'

/**
 * DEVELOPMENT ONLY. Simulates a marketplace trade by elapsed time:
 * 0–20s "ищем продавца" → 20–60s "примите трейд" → then "выведено".
 * Never enabled in production (see `tradesMockAllowed`), because it does not deliver anything to Steam.
 */
export class MockTradeProvider implements TradeProvider {
  readonly id = 'mock'
  async requestWithdrawal(input: { withdrawalId: string }) {
    return { externalId: `mock_${input.withdrawalId}` }
  }
  async getStatus(_externalId: string, createdAt: Date): Promise<TradeState> {
    const s = (Date.now() - createdAt.getTime()) / 1000
    if (s < 20) return { status: 'searching', message: 'Ищем продавца' }
    if (s < 60) return { status: 'waiting_accept', message: 'Продавец отправил трейд — примите его в Steam', tradeOfferId: '0000000000' }
    return { status: 'completed', message: 'Выведено' }
  }
}
