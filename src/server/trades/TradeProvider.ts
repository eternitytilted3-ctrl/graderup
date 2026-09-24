/**
 * Delivers skins to the player's Steam account (marketplace bot, P2P service, own bots…).
 * The platform debits nothing here: the inventory item is locked while the trade is in progress
 * and is marked `withdrawn` only when the provider reports the trade as completed.
 */
export type TradeStatus = 'searching' | 'waiting_accept' | 'completed' | 'failed'

export interface TradeState {
  status: TradeStatus
  message?: string
  tradeOfferId?: string
}

export interface TradeProvider {
  readonly id: string
  /** Starts buying/sending `marketHashName` to `tradeUrl`, spending at most `maxPrice` (coins). */
  requestWithdrawal(input: { withdrawalId: string; marketHashName: string; maxPrice: string; tradeUrl: string }): Promise<{ externalId: string }>
  getStatus(externalId: string, createdAt: Date): Promise<TradeState>
}
