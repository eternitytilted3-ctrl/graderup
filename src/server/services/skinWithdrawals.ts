import 'server-only'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { itemWithdrawals, items, userItems, users } from '../db/schema'
import { Errors } from '../http/errors'
import { getTradeProvider } from '../trades'
import { lockUser } from './ledger'
import { logAdmin, logEvent } from './log'
import { toItemDTO } from './mappers'
import { getSetting } from './settings'

export const TRADE_URL_RE = /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d{1,12}&token=[A-Za-z0-9_-]{6,16}$/

const ACTIVE = ['searching', 'waiting_accept'] as const

export async function skinWithdrawConfig() {
  const cfg = await getSetting('skinWithdraw')
  const provider = getTradeProvider()
  return { ...cfg, available: cfg.enabled && Boolean(provider), provider: provider?.id ?? null }
}

export async function setTradeUrl(userId: string, tradeUrl: string) {
  if (!TRADE_URL_RE.test(tradeUrl)) throw Errors.validation({ fields: { tradeUrl: 'Некорректная ссылка на обмен Steam' } })
  await getDb().update(users).set({ steamTradeUrl: tradeUrl, updatedAt: new Date() }).where(eq(users.id, userId))
  return { tradeUrl }
}

/** Locks the inventory item and asks the trade provider to deliver it to the user's Steam account. */
export async function requestSkinWithdrawal(userId: string, userItemId: string, ip?: string) {
  const cfg = await skinWithdrawConfig()
  const provider = getTradeProvider()
  if (!cfg.available || !provider) throw Errors.disabled('Вывод скинов сейчас недоступен')
  const db = getDb()
  const created = await db.transaction(async (tx) => {
    const user = await lockUser(tx, userId)
    if (!user.steamTradeUrl || !TRADE_URL_RE.test(user.steamTradeUrl)) throw Errors.validation({ fields: { tradeUrl: 'Укажите ссылку на обмен Steam' } })
    const [{ n }] = await tx
      .select({ n: count() })
      .from(itemWithdrawals)
      .where(and(eq(itemWithdrawals.userId, userId), inArray(itemWithdrawals.status, [...ACTIVE])))
    if (n >= cfg.maxActive) throw Errors.conflict(`Одновременно можно выводить не больше ${cfg.maxActive} скинов`, 'SKIN_WITHDRAW_LIMIT')
    const [locked] = await tx
      .update(userItems)
      .set({ status: 'locked', updatedAt: new Date() })
      .where(and(eq(userItems.id, userItemId), eq(userItems.userId, userId), eq(userItems.status, 'available')))
      .returning()
    if (!locked) throw Errors.conflict('Предмет недоступен для вывода', 'ITEM_UNAVAILABLE')
    const [item] = await tx.select().from(items).where(eq(items.id, locked.itemId))
    const [w] = await tx
      .insert(itemWithdrawals)
      .values({ userId, userItemId, itemId: item.id, price: item.price, tradeUrl: user.steamTradeUrl, provider: provider.id, statusMessage: 'Ищем продавца' })
      .returning()
    return { w, item }
  })
  try {
    const { externalId } = await provider.requestWithdrawal({
      withdrawalId: created.w.id,
      marketHashName: created.item.marketHashName ?? created.item.name,
      maxPrice: created.item.price,
      tradeUrl: created.w.tradeUrl,
    })
    await db.update(itemWithdrawals).set({ externalId, updatedAt: new Date() }).where(eq(itemWithdrawals.id, created.w.id))
  } catch (err) {
    await failWithdrawal(created.w.id, 'Провайдер недоступен, предмет возвращён в инвентарь')
    void logEvent('skin_withdraw_provider_error', { level: 'error', userId, details: { id: created.w.id, message: (err as Error).message } })
    throw Errors.disabled('Сервис вывода временно недоступен')
  }
  void logEvent('skin_withdraw_request', { userId, ip, details: { id: created.w.id, item: created.item.name, price: created.item.price } })
  return { id: created.w.id, status: 'searching' as const }
}

/** Failed/cancelled → the item goes back to the inventory. */
async function failWithdrawal(id: string, message: string, status: 'failed' | 'cancelled' = 'failed') {
  await getDb().transaction(async (tx) => {
    const [w] = await tx.select().from(itemWithdrawals).where(eq(itemWithdrawals.id, id)).for('update')
    if (!w || !ACTIVE.includes(w.status as (typeof ACTIVE)[number])) return
    await tx.update(itemWithdrawals).set({ status, statusMessage: message, updatedAt: new Date() }).where(eq(itemWithdrawals.id, id))
    await tx.update(userItems).set({ status: 'available', updatedAt: new Date() }).where(and(eq(userItems.id, w.userItemId), eq(userItems.status, 'locked')))
  })
}

/** Polls the provider for the user's active withdrawals and applies state transitions. */
export async function refreshSkinWithdrawals(userId?: string) {
  const provider = getTradeProvider()
  if (!provider) return
  const db = getDb()
  const active = await db
    .select()
    .from(itemWithdrawals)
    .where(and(inArray(itemWithdrawals.status, [...ACTIVE]), eq(itemWithdrawals.provider, provider.id), userId ? eq(itemWithdrawals.userId, userId) : undefined))
    .limit(100)
  for (const w of active) {
    if (!w.externalId) continue
    const st = await provider.getStatus(w.externalId, w.createdAt).catch(() => null)
    if (!st || (st.status === w.status && (st.message ?? null) === w.statusMessage)) continue
    if (st.status === 'failed') {
      await failWithdrawal(w.id, st.message ?? 'Трейд не состоялся, предмет возвращён в инвентарь')
      continue
    }
    await db.transaction(async (tx) => {
      const [cur] = await tx.select().from(itemWithdrawals).where(eq(itemWithdrawals.id, w.id)).for('update')
      if (!cur || !ACTIVE.includes(cur.status as (typeof ACTIVE)[number])) return
      await tx
        .update(itemWithdrawals)
        .set({
          status: st.status,
          statusMessage: st.message ?? null,
          tradeOfferId: st.tradeOfferId ?? cur.tradeOfferId,
          completedAt: st.status === 'completed' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(itemWithdrawals.id, w.id))
      if (st.status === 'completed') {
        await tx.update(userItems).set({ status: 'withdrawn', updatedAt: new Date() }).where(and(eq(userItems.id, cur.userItemId), eq(userItems.status, 'locked')))
      }
    })
    if (st.status === 'completed') void logEvent('skin_withdraw_completed', { userId: w.userId, details: { id: w.id } })
  }
}

export async function listSkinWithdrawals(userId: string, limit = 20) {
  await refreshSkinWithdrawals(userId)
  const rows = await getDb()
    .select({ w: itemWithdrawals, item: items })
    .from(itemWithdrawals)
    .innerJoin(items, eq(items.id, itemWithdrawals.itemId))
    .where(eq(itemWithdrawals.userId, userId))
    .orderBy(desc(itemWithdrawals.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    id: r.w.id,
    status: r.w.status,
    message: r.w.statusMessage,
    tradeOfferId: r.w.tradeOfferId,
    price: r.w.price,
    createdAt: r.w.createdAt.toISOString(),
    completedAt: r.w.completedAt?.toISOString() ?? null,
    item: toItemDTO(r.item),
  }))
}

/** Public counter: skins actually delivered (completed withdrawals). */
let statCache: { at: number; data: { count: number; value: string } } | null = null
export async function skinWithdrawStats() {
  if (statCache && Date.now() - statCache.at < 30_000) return statCache.data
  const [r] = await getDb()
    .select({ count: count(), value: sql<string>`coalesce(sum(${itemWithdrawals.price}),0)::numeric(18,2)::text` })
    .from(itemWithdrawals)
    .where(eq(itemWithdrawals.status, 'completed'))
  statCache = { at: Date.now(), data: { count: r.count, value: r.value } }
  return statCache.data
}

/** Admin: list + cancel (returns the item). */
export async function listSkinWithdrawalsAdmin(limit = 100) {
  await refreshSkinWithdrawals()
  const rows = await getDb()
    .select({ w: itemWithdrawals, item: items, username: users.username })
    .from(itemWithdrawals)
    .innerJoin(items, eq(items.id, itemWithdrawals.itemId))
    .innerJoin(users, eq(users.id, itemWithdrawals.userId))
    .orderBy(desc(itemWithdrawals.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    id: r.w.id,
    userId: r.w.userId,
    username: r.username,
    status: r.w.status,
    message: r.w.statusMessage,
    provider: r.w.provider,
    price: r.w.price,
    itemName: r.item.name,
    createdAt: r.w.createdAt.toISOString(),
  }))
}

export async function cancelSkinWithdrawal(adminId: string, id: string, ip?: string) {
  await failWithdrawal(id, 'Отменено администрацией, предмет возвращён в инвентарь', 'cancelled')
  await logAdmin(getDb(), { adminId, action: 'skin_withdraw_cancel', targetType: 'item_withdrawal', targetId: id, ip })
  return { ok: true }
}
