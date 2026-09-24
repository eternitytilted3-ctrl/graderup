import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import { toMoney } from '@/lib/money'
import { getDb } from '../db/client'
import { items, promocodeUses, promocodes, userItems, users } from '../db/schema'
import { Errors } from '../http/errors'
import { applyBalanceChange, lockUser } from './ledger'
import { logEvent } from './log'
import { toItemDTO } from './mappers'

/**
 * Redeems a promo code. All checks are server-side:
 * conditional UPDATE (active, not expired, used_count < max_uses) + UNIQUE(promocode_id, user_id).
 */
export async function redeemPromocode(userId: string, rawCode: string, ip?: string) {
  const code = rawCode.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw Errors.badRequest('Некорректный промокод')
  const db = getDb()
  const result = await db.transaction(async (tx) => {
    await lockUser(tx, userId)
    const [promo] = await tx
      .update(promocodes)
      .set({ usedCount: sql`${promocodes.usedCount} + 1`, updatedAt: new Date() })
      .where(
        and(
          sql`upper(${promocodes.code}) = ${code}`,
          eq(promocodes.active, true),
          lt(promocodes.usedCount, promocodes.maxUses),
          or(isNull(promocodes.expiresAt), gt(promocodes.expiresAt, sql`now()`)),
        ),
      )
      .returning()
    if (!promo) throw Errors.notFound('Промокод не найден, истёк или исчерпан')

    const used = await tx.insert(promocodeUses).values({ promocodeId: promo.id, userId }).onConflictDoNothing().returning({ id: promocodeUses.id })
    if (used.length === 0) throw Errors.conflict('Вы уже активировали этот промокод', 'ALREADY_USED')

    if (promo.type === 'fixed') {
      const r = await applyBalanceChange(tx, {
        userId,
        type: 'bonus',
        amount: toMoney(promo.value),
        referenceType: 'promocode',
        referenceId: promo.id,
        meta: { promocode: promo.code },
      })
      return { type: 'fixed' as const, amount: toMoney(promo.value), balance: r.balanceAfter }
    }
    if (promo.type === 'percentage') {
      await tx.update(users).set({ depositBonusPercent: promo.value, updatedAt: new Date() }).where(eq(users.id, userId))
      return { type: 'percentage' as const, percent: promo.value }
    }
    if (!promo.itemId) throw Errors.conflict('Промокод настроен некорректно')
    const [item] = await tx.select().from(items).where(eq(items.id, promo.itemId))
    if (!item) throw Errors.conflict('Предмет промокода недоступен')
    const userItemId = randomUUID()
    await tx.insert(userItems).values({ id: userItemId, userId, itemId: item.id, source: 'promocode', sourceReference: promo.id })
    await applyBalanceChange(tx, {
      userId,
      type: 'bonus',
      amount: 0,
      referenceType: 'promocode',
      referenceId: promo.id,
      meta: { promocode: promo.code, itemId: item.id, itemName: item.name, itemPrice: item.price, rarity: item.rarity },
    })
    return { type: 'item' as const, item: toItemDTO(item), userItemId }
  })
  void logEvent('promocode_redeem', { userId, ip, details: { code, type: result.type } })
  return result
}
