import 'server-only'
import { eq } from 'drizzle-orm'
import { D, toMoney, type MoneyInput } from '@/lib/money'
import type { Tx } from '../db/client'
import { transactions, users, type TransactionType } from '../db/schema'
import { Errors } from '../http/errors'

/**
 * Locks the user row (SELECT … FOR UPDATE) for the rest of the DB transaction.
 * EVERY mutating game/money operation calls this first, so all operations of one user
 * are serialized and the lock order (user → user_items) is identical everywhere (no deadlocks).
 */
export async function lockUser(tx: Tx, userId: string) {
  const [u] = await tx.select().from(users).where(eq(users.id, userId)).for('update')
  if (!u) throw Errors.notFound('Пользователь не найден')
  if (u.isBanned) throw Errors.banned()
  return u
}

export interface BalanceChange {
  userId: string
  type: TransactionType
  /** Signed amount: negative = debit. Zero allowed (audit record for upgrades). */
  amount: MoneyInput
  referenceType?: string
  referenceId?: string
  meta?: Record<string, unknown>
  /** Allow the change for a banned user (admin adjustments / refunds). */
  allowBanned?: boolean
}

/**
 * The ONLY place where users.balance is modified. Writes an auditable transaction row
 * with balance_before / balance_after in the same DB transaction.
 */
export async function applyBalanceChange(tx: Tx, change: BalanceChange) {
  const [u] = await tx
    .select({ balance: users.balance, isBanned: users.isBanned })
    .from(users)
    .where(eq(users.id, change.userId))
    .for('update')
  if (!u) throw Errors.notFound('Пользователь не найден')
  if (u.isBanned && !change.allowBanned) throw Errors.banned()

  const amount = D(change.amount)
  if (amount.decimalPlaces() > 2) throw Errors.badRequest('Сумма должна иметь не более 2 знаков после запятой')
  const before = D(u.balance)
  const after = before.plus(amount)
  if (after.isNegative()) throw Errors.insufficientFunds()

  await tx.update(users).set({ balance: toMoney(after), updatedAt: new Date() }).where(eq(users.id, change.userId))
  const [row] = await tx
    .insert(transactions)
    .values({
      userId: change.userId,
      type: change.type,
      amount: toMoney(amount),
      balanceBefore: toMoney(before),
      balanceAfter: toMoney(after),
      referenceType: change.referenceType ?? null,
      referenceId: change.referenceId ?? null,
      status: 'completed',
      meta: change.meta ?? null,
    })
    .returning()
  return { transaction: row, balanceBefore: toMoney(before), balanceAfter: toMoney(after) }
}
