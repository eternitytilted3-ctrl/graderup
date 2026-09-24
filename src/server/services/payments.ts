import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { env } from '@/config/env'
import { D, toMoney } from '@/lib/money'
import { amlScreen } from '../compliance/kyc'
import { getDb } from '../db/client'
import { payments, users } from '../db/schema'
import { Errors } from '../http/errors'
import { getPaymentProvider } from '../payments'
import { WebhookSignatureError } from '../payments/PaymentProvider'
import { applyBalanceChange } from './ledger'
import { logEvent } from './log'
import { getSetting } from './settings'

function toPaymentDTO(p: typeof payments.$inferSelect) {
  return {
    id: p.id,
    provider: p.provider,
    amount: p.amount,
    bonusAmount: p.bonusAmount,
    currency: p.currency,
    status: p.status,
    checkoutUrl: p.status === 'pending' ? p.checkoutUrl : null,
    createdAt: p.createdAt.toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
  }
}

export async function createPayment(userId: string, amountInput: number, ip?: string) {
  const cfg = await getSetting('deposit')
  const amount = toMoney(amountInput)
  if (D(amount).lt(cfg.minAmount) || D(amount).gt(cfg.maxAmount)) {
    throw Errors.badRequest(`Сумма пополнения должна быть от $${cfg.minAmount} до $${cfg.maxAmount}`)
  }
  const provider = getPaymentProvider()
  const db = getDb()
  const [p] = await db.insert(payments).values({ userId, provider: provider.id, amount, currency: cfg.currency }).returning()
  try {
    const appUrl = env().APP_URL
    const checkout = await provider.createCheckout({
      paymentId: p.id,
      userId,
      amount,
      currency: cfg.currency,
      returnUrl: `${appUrl}/deposit?payment=${p.id}`,
      webhookUrl: `${appUrl}/api/payments/webhook/${provider.id}`,
    })
    const [updated] = await db
      .update(payments)
      .set({ externalId: checkout.externalId, checkoutUrl: checkout.checkoutUrl, updatedAt: new Date() })
      .where(eq(payments.id, p.id))
      .returning()
    void logEvent('deposit_created', { userId, ip, details: { paymentId: p.id, amount, provider: provider.id } })
    return toPaymentDTO(updated)
  } catch (err) {
    await db.update(payments).set({ status: 'failed', updatedAt: new Date() }).where(eq(payments.id, p.id))
    void logEvent('deposit_provider_error', { level: 'error', userId, details: { paymentId: p.id, message: (err as Error).message } })
    throw Errors.disabled('Платёжный сервис временно недоступен')
  }
}

export async function getPayment(userId: string, paymentId: string) {
  const [p] = await getDb().select().from(payments).where(and(eq(payments.id, paymentId), eq(payments.userId, userId)))
  if (!p) throw Errors.notFound('Платёж не найден')
  return toPaymentDTO(p)
}

export async function listPayments(userId: string, limit = 10) {
  const rows = await getDb().select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)).limit(limit)
  return rows.map(toPaymentDTO)
}

/**
 * Handles a provider webhook. Idempotent: only a `pending → completed` transition
 * (conditional on the locked row) credits the balance, so replays never double-credit.
 */
export async function handleWebhook(providerId: string, rawBody: string, headers: Headers, ip?: string) {
  const provider = getPaymentProvider(providerId)
  let event
  try {
    event = await provider.verifyWebhook(rawBody, headers)
  } catch (err) {
    void logEvent('webhook_invalid_signature', { level: 'security', ip, details: { provider: providerId, error: err instanceof WebhookSignatureError ? 'signature' : 'parse' } })
    throw Errors.forbidden('Invalid signature')
  }

  const db = getDb()
  const outcome = await db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.provider, provider.id), eq(payments.externalId, event.externalId)))
      .for('update')
    if (!p) throw Errors.notFound('Payment not found')
    if (p.status !== 'pending') return { status: p.status, credited: false, paymentId: p.id, userId: p.userId }

    if (event.status === 'completed') {
      if (!D(event.amount).eq(p.amount) || event.currency !== p.currency) {
        void logEvent('webhook_amount_mismatch', { level: 'security', userId: p.userId, details: { paymentId: p.id, expected: p.amount, got: event.amount } })
        throw Errors.badRequest('Amount mismatch')
      }
      const [user] = await tx.select().from(users).where(eq(users.id, p.userId)).for('update')
      const [{ n: prevDeposits }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(payments)
        .where(and(eq(payments.userId, p.userId), eq(payments.status, 'completed')))

      await applyBalanceChange(tx, {
        userId: p.userId,
        type: 'deposit',
        amount: p.amount,
        referenceType: 'payment',
        referenceId: p.id,
        meta: { provider: provider.id, externalId: event.externalId },
        allowBanned: true,
      })

      // Bonuses: pending % promocode, or referral welcome bonus on first deposit.
      let bonusPercent = D(user.depositBonusPercent)
      let bonusReason = 'promocode'
      if (bonusPercent.lte(0) && prevDeposits === 0 && user.referredBy) {
        bonusPercent = D((await getSetting('referral', tx)).inviteeBonusPercent)
        bonusReason = 'referral_welcome'
      }
      let bonusAmount = '0.00'
      if (bonusPercent.gt(0)) {
        bonusAmount = toMoney(D(p.amount).mul(bonusPercent).div(100), 1)
        if (D(bonusAmount).gt(0)) {
          await applyBalanceChange(tx, {
            userId: p.userId,
            type: 'bonus',
            amount: bonusAmount,
            referenceType: 'payment',
            referenceId: p.id,
            meta: { reason: bonusReason, percent: bonusPercent.toString() },
            allowBanned: true,
          })
        }
        if (bonusReason === 'promocode') {
          await tx.update(users).set({ depositBonusPercent: '0', updatedAt: new Date() }).where(eq(users.id, p.userId))
        }
      }
      await tx
        .update(payments)
        .set({ status: 'completed', bonusAmount, completedAt: new Date(), rawPayload: event.raw as object, updatedAt: new Date() })
        .where(eq(payments.id, p.id))
      const flagged = await amlScreen({ userId: p.userId, type: 'deposit', amount: p.amount })
      return { status: 'completed' as const, credited: true, paymentId: p.id, userId: p.userId, flagged }
    }
    if (event.status === 'pending') return { status: 'pending' as const, credited: false, paymentId: p.id, userId: p.userId }
    await tx.update(payments).set({ status: event.status, rawPayload: event.raw as object, updatedAt: new Date() }).where(eq(payments.id, p.id))
    return { status: event.status, credited: false, paymentId: p.id, userId: p.userId }
  })
  void logEvent('deposit_webhook', { userId: outcome.userId, ip, details: { paymentId: outcome.paymentId, status: outcome.status, credited: outcome.credited } })
  return { received: true, status: outcome.status }
}
