import 'server-only'
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { D, toMoney } from '@/lib/money'
import type { InventoryItemDTO, Rarity } from '@/lib/types'
import { getDb } from '../db/client'
import { items, userItems } from '../db/schema'
import { Errors } from '../http/errors'
import { applyBalanceChange, lockUser } from './ledger'
import { logEvent } from './log'
import { paginate, toItemDTO } from './mappers'
import { getSetting } from './settings'

export type InventorySort = 'date_desc' | 'date_asc' | 'price_desc' | 'price_asc' | 'rarity_desc' | 'rarity_asc'

export async function listInventory(
  userId: string,
  opts: { page: number; pageSize: number; rarity?: Rarity; sort?: InventorySort; status?: 'available' | 'all'; search?: string; minPrice?: string },
) {
  const db = getDb()
  const conds: SQL[] = [eq(userItems.userId, userId)]
  if (opts.status !== 'all') conds.push(eq(userItems.status, 'available'))
  if (opts.rarity) conds.push(eq(items.rarity, opts.rarity))
  if (opts.search) conds.push(sql`${items.name} ILIKE ${'%' + opts.search.replace(/[%_\\]/g, '\\$&') + '%'}`)
  if (opts.minPrice) conds.push(sql`${items.price} >= ${opts.minPrice}`)
  const where = and(...conds)

  const order = {
    date_desc: [desc(userItems.createdAt), desc(userItems.id)],
    date_asc: [asc(userItems.createdAt), asc(userItems.id)],
    price_desc: [desc(items.price), desc(userItems.createdAt)],
    price_asc: [asc(items.price), desc(userItems.createdAt)],
    rarity_desc: [desc(items.rarity), desc(items.price)],
    rarity_asc: [asc(items.rarity), asc(items.price)],
  }[opts.sort ?? 'date_desc']

  const [rows, [{ total, value }]] = await Promise.all([
    db
      .select({ ui: userItems, item: items })
      .from(userItems)
      .innerJoin(items, eq(items.id, userItems.itemId))
      .where(where)
      .orderBy(...order)
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ total: sql<number>`count(*)::int`, value: sql<string>`coalesce(sum(${items.price}), 0)::numeric(18,2)::text` })
      .from(userItems)
      .innerJoin(items, eq(items.id, userItems.itemId))
      .where(where),
  ])
  const sellRatio = (await getSetting('inventory')).sellRatio
  const list: (InventoryItemDTO & { sellPrice: string })[] = rows.map((r) => ({
    id: r.ui.id,
    status: r.ui.status,
    source: r.ui.source,
    createdAt: r.ui.createdAt.toISOString(),
    item: toItemDTO(r.item, true),
    sellPrice: toMoney(D(r.item.price).mul(sellRatio), 1),
  }))
  return { ...paginate(list, total, opts.page, opts.pageSize), totalValue: value, sellRatio }
}

/**
 * Sells one or more inventory items atomically. The conditional UPDATE
 * (`status = 'available' AND user_id = me`) makes double-selling and selling
 * someone else's item impossible even under concurrent requests.
 */
export async function sellItems(userId: string, userItemIds: string[], ip?: string) {
  const ids = [...new Set(userItemIds)]
  if (ids.length === 0 || ids.length > 200) throw Errors.badRequest('Выберите от 1 до 200 предметов')
  const sellRatio = (await getSetting('inventory')).sellRatio
  const db = getDb()
  const out = await db.transaction(async (tx) => {
    await lockUser(tx, userId)
    const sold = await tx
      .update(userItems)
      .set({ status: 'sold', updatedAt: new Date() })
      .where(and(inArray(userItems.id, ids), eq(userItems.userId, userId), eq(userItems.status, 'available')))
      .returning({ id: userItems.id, itemId: userItems.itemId })
    if (sold.length !== ids.length) {
      // Rolls back the whole batch: some item is not ours, already sold or used.
      throw Errors.conflict('Предмет недоступен для продажи', 'ITEM_UNAVAILABLE')
    }
    const itemRows = await tx.select().from(items).where(inArray(items.id, [...new Set(sold.map((s) => s.itemId))]))
    const byId = new Map(itemRows.map((i) => [i.id, i]))
    let balance = '0'
    let total = D(0)
    for (const s of sold) {
      const item = byId.get(s.itemId)!
      const amount = toMoney(D(item.price).mul(sellRatio), 1)
      total = total.plus(amount)
      const r = await applyBalanceChange(tx, {
        userId,
        type: 'item_sell',
        amount,
        referenceType: 'user_item',
        referenceId: s.id,
        meta: { itemId: item.id, itemName: item.name, itemPrice: item.price, rarity: item.rarity, sellRatio },
      })
      balance = r.balanceAfter
    }
    return { soldCount: sold.length, amount: toMoney(total), balance }
  })
  void logEvent('item_sell', { userId, ip, details: { ids, amount: out.amount } })
  return out
}

export async function getUserItem(userId: string, userItemId: string) {
  const [row] = await getDb()
    .select({ ui: userItems, item: items })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(eq(userItems.id, userItemId), eq(userItems.userId, userId)))
  if (!row) throw Errors.notFound('Предмет не найден')
  return {
    id: row.ui.id,
    status: row.ui.status,
    source: row.ui.source,
    createdAt: row.ui.createdAt.toISOString(),
    item: toItemDTO(row.item, true),
  }
}

/** Sells every available item of the user in one DB transaction (one ledger row per item). */
export async function sellAllItems(userId: string, ip?: string) {
  const sellRatio = (await getSetting('inventory')).sellRatio
  const out = await getDb().transaction(async (tx) => {
    await lockUser(tx, userId)
    const sold = await tx
      .update(userItems)
      .set({ status: 'sold', updatedAt: new Date() })
      .where(and(eq(userItems.userId, userId), eq(userItems.status, 'available')))
      .returning({ id: userItems.id, itemId: userItems.itemId })
    if (sold.length === 0) throw Errors.conflict('Нет предметов для продажи', 'NOTHING_TO_SELL')
    const itemRows = await tx.select().from(items).where(inArray(items.id, [...new Set(sold.map((s) => s.itemId))]))
    const byId = new Map(itemRows.map((i) => [i.id, i]))
    let total = D(0)
    let balance = '0'
    for (const s of sold) {
      const item = byId.get(s.itemId)!
      const amount = toMoney(D(item.price).mul(sellRatio), 1)
      total = total.plus(amount)
      balance = (
        await applyBalanceChange(tx, {
          userId,
          type: 'item_sell',
          amount,
          referenceType: 'user_item',
          referenceId: s.id,
          meta: { itemId: item.id, itemName: item.name, itemPrice: item.price, rarity: item.rarity, sellRatio, bulk: 'all' },
        })
      ).balanceAfter
    }
    return { soldCount: sold.length, amount: toMoney(total), balance }
  })
  void logEvent('item_sell_all', { userId, ip, details: { count: out.soldCount, amount: out.amount } })
  return out
}
