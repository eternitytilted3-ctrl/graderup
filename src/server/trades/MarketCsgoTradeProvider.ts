import type { TradeProvider, TradeState } from './TradeProvider'

/**
 * Real skin delivery through market.csgo.com "buy-for": the site buys the skin on the marketplace from
 * its own market balance and the seller sends the trade offer straight to the player's trade URL.
 * Requirements: MARKETCSGO_API_KEY (market account settings) and a funded market balance (RUB).
 * API: https://market.csgo.com/ru/api — verify parameter names/stages against the current docs
 * before going live (the adapter is tolerant, but the docs are the source of truth).
 *
 *   buy-for?key&hash_name&price(kopecks, max)&partner&token&custom_id   → { success, id, price } | { success:false, error }
 *   get-buy-info-by-custom-id?key&custom_id                              → { success, data: { stage, trade_id?, … } }
 *   stage: 1 = waiting for the seller to send the offer, 2 = delivered, 5 = cancelled/timeout (money refunded).
 */
export class MarketCsgoTradeProvider implements TradeProvider {
  readonly id = 'marketcsgo'

  constructor(private readonly cfg: { apiKey: string; apiUrl: string; maxOverpayPercent: number }) {}

  private async call(path: string, params: Record<string, string>) {
    const qs = new URLSearchParams({ key: this.cfg.apiKey, ...params })
    const res = await fetch(`${this.cfg.apiUrl}/${path}?${qs}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`market.csgo.com ${path}: HTTP ${res.status}`)
    return (await res.json()) as Record<string, unknown>
  }

  async requestWithdrawal(input: { withdrawalId: string; marketHashName: string; maxPrice: string; tradeUrl: string }) {
    const url = new URL(input.tradeUrl)
    const partner = url.searchParams.get('partner') ?? ''
    const token = url.searchParams.get('token') ?? ''
    if (!partner || !token) throw new Error('Trade URL without partner/token')
    // Max price we agree to pay, in kopecks (item price + allowed overpay).
    const cap = Math.floor(Number(input.maxPrice) * 100 * (1 + this.cfg.maxOverpayPercent / 100))
    const r = await this.call('buy-for', { hash_name: input.marketHashName, price: String(cap), partner, token, custom_id: input.withdrawalId })
    if (r.success !== true) throw new Error(`market.csgo.com buy-for: ${String(r.error ?? 'failed')}`)
    return { externalId: input.withdrawalId }
  }

  async getStatus(externalId: string): Promise<TradeState> {
    const r = await this.call('get-buy-info-by-custom-id', { custom_id: externalId })
    if (r.success !== true) return { status: 'searching', message: 'Ищем продавца' }
    const data = (r.data ?? {}) as Record<string, unknown>
    const stage = String(data.stage ?? '')
    const tradeId = data.trade_id ?? data.tradeofferid ?? data.trade_offer_id
    if (stage === '2') return { status: 'completed', message: 'Выведено' }
    if (stage === '5') return { status: 'failed', message: 'Продавец не передал предмет — предмет возвращён в инвентарь' }
    if (tradeId) return { status: 'waiting_accept', message: 'Продавец отправил трейд — примите его в Steam', tradeOfferId: String(tradeId) }
    return { status: 'searching', message: 'Продавец готовит обмен' }
  }
}
