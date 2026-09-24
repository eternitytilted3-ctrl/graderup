import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { env } from '@/config/env'
import { D, toMoney } from '@/lib/money'
import { amlScreen, assertWithdrawalAllowed } from '../compliance/kyc'
import { getDb } from '../db/client'
import { withdrawals } from '../db/schema'
import { Errors } from '../http/errors'
import { applyBalanceChange, lockUser } from './ledger'
import { logAdmin, logEvent } from './log'
import { getSetting } from './settings'

export async function withdrawConfig() {
  const cfg = await getSetting('withdraw')
  return { ...cfg, enabled: cfg.enabled && env().FEATURE_WITHDRAW, kycThreshold: env().KYC_WITHDRAW_THRESHOLD }
}

/** Creates a withdrawal request: the amount is debited (reserved) immediately and refunded if rejected. */
export async function requestWithdrawal(userId: string, input: { amount: number; method: string; destination: string }, ip?: string) {
  const cfg = await withdrawConfig()
  if (!cfg.enabled) throw Errors.disabled('Вывод средств сейчас недоступен')
  const amount = toMoney(input.amount)
  if (D(amount).lt(cfg.minAmount) || D(amount).gt(cfg.maxAmount)) throw Errors.badRequest(`Сумма вывода: от $${cfg.minAmount} до $${cfg.maxAmount}`)
  if (!cfg.methods.includes(input.method)) throw Errors.badRequest('Неподдерживаемый способ вывода')

  const out = await getDb().transaction(async (tx) => {
    const user = await lockUser(tx, userId)
    assertWithdrawalAllowed(user, amount)
    const [w] = await tx.insert(withdrawals).values({ userId, amount, method: input.method, destination: input.destination }).returning()
    const r = await applyBalanceChange(tx, {
      userId,
      type: 'withdraw',
      amount: D(amount).neg(),
      referenceType: 'withdrawal',
      referenceId: w.id,
      meta: { method: input.method },
    })
    return { id: w.id, amount, status: w.status, balance: r.balanceAfter }
  })
  const flagged = await amlScreen({ userId, type: 'withdraw', amount })
  void logEvent('withdraw_request', { userId, ip, details: { withdrawalId: out.id, amount, flagged } })
  return out
}

export async function listWithdrawals(userId: string, limit = 10) {
  const rows = await getDb().select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt)).limit(limit)
  return rows.map((w) => ({
    id: w.id,
    amount: w.amount,
    method: w.method,
    destination: w.destination.replace(/^(.{4}).*(.{4})$/, '$1••••$2'),
    status: w.status,
    createdAt: w.createdAt.toISOString(),
  }))
}

/** Admin: approve (payout executed externally) or reject (refund to balance). */
export async function processWithdrawal(adminId: string, withdrawalId: string, action: 'approve' | 'reject', note: string | undefined, ip?: string) {
  return getDb().transaction(async (tx) => {
    const [w] = await tx.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).for('update')
    if (!w) throw Errors.notFound('Заявка не найдена')
    if (w.status !== 'pending') throw Errors.conflict('Заявка уже обработана')
    if (action === 'reject') {
      await applyBalanceChange(tx, {
        userId: w.userId,
        type: 'refund',
        amount: w.amount,
        referenceType: 'withdrawal',
        referenceId: w.id,
        meta: { reason: note ?? 'withdrawal rejected' },
        allowBanned: true,
      })
    }
    const status = action === 'approve' ? 'completed' : 'rejected'
    await tx
      .update(withdrawals)
      .set({ status, adminNote: note ?? null, processedBy: adminId, processedAt: new Date(), updatedAt: new Date() })
      .where(eq(withdrawals.id, w.id))
    await logAdmin(tx, { adminId, action: `withdrawal_${action}`, targetType: 'withdrawal', targetId: w.id, details: { amount: w.amount, userId: w.userId, note }, ip })
    return { id: w.id, status }
  })
}
