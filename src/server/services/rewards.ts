import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { D, toMoney } from '@/lib/money'
import { getDb, type Executor } from '../db/client'
import { payments, rewardClaims, rewards, users } from '../db/schema'
import { Errors } from '../http/errors'
import { applyBalanceChange, lockUser } from './ledger'
import { logEvent } from './log'

const DAY = 86_400
/** 1970-01-05 was a Monday → weekly windows start on Monday 00:00 UTC. */
const WEEK_OFFSET = 4 * DAY

/** Fixed claim window for periodic rewards. The period key + UNIQUE constraint make double claims impossible. */
export function rewardWindow(type: 'daily' | 'weekly' | 'referral', cooldownSeconds: number, now = Date.now()) {
  const sec = Math.floor(now / 1000)
  const offset = type === 'weekly' ? WEEK_OFFSET : 0
  const idx = Math.floor((sec - offset) / cooldownSeconds)
  const nextAt = new Date((offset + (idx + 1) * cooldownSeconds) * 1000)
  return { periodKey: `${type}:${cooldownSeconds}:${idx}`, nextAt }
}

async function depositTotal(userId: string, ex: Executor = getDb()) {
  const [r] = await ex
    .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)::text` })
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, 'completed')))
  return r?.total ?? '0'
}

/** Referred users who made a completed deposit and for whom the referrer has not claimed yet. */
async function pendingReferrals(userId: string, rewardId: string, db: Executor = getDb()) {
  const rows = await db
    .selectDistinct({ id: users.id, username: users.username })
    .from(users)
    .innerJoin(payments, and(eq(payments.userId, users.id), eq(payments.status, 'completed')))
    .leftJoin(
      rewardClaims,
      and(eq(rewardClaims.userId, userId), eq(rewardClaims.rewardId, rewardId), eq(rewardClaims.periodKey, sql`'ref:' || ${users.id}::text`)),
    )
    .where(and(eq(users.referredBy, userId), isNull(rewardClaims.id)))
  return rows
}

export async function listRewards(userId: string) {
  const db = getDb()
  const [all, deposited, referredCount] = await Promise.all([
    db.select().from(rewards).where(eq(rewards.isActive, true)),
    depositTotal(userId),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.referredBy, userId)),
  ])
  const out = []
  for (const r of all) {
    const requirementMet = D(deposited).gte(r.minDepositTotal)
    if (r.type === 'referral') {
      const pending = await pendingReferrals(userId, r.id)
      out.push({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        amount: r.amount,
        claimable: pending.length > 0,
        pendingCount: pending.length,
        claimableAmount: toMoney(D(r.amount).mul(pending.length)),
        referredCount: referredCount[0]?.n ?? 0,
        nextAt: null,
        requirement: null,
      })
      continue
    }
    const { periodKey, nextAt } = rewardWindow(r.type, r.cooldownSeconds)
    const [claimed] = await db
      .select({ id: rewardClaims.id })
      .from(rewardClaims)
      .where(and(eq(rewardClaims.userId, userId), eq(rewardClaims.rewardId, r.id), eq(rewardClaims.periodKey, periodKey)))
    out.push({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      amount: r.amount,
      claimable: !claimed && requirementMet,
      claimedThisPeriod: Boolean(claimed),
      nextAt: claimed ? nextAt.toISOString() : null,
      requirement: requirementMet ? null : { minDepositTotal: r.minDepositTotal, deposited },
    })
  }
  return out
}

export async function claimReward(userId: string, rewardIdOrType: string, ip?: string) {
  const db = getDb()
  const isType = ['daily', 'weekly', 'referral'].includes(rewardIdOrType)
  const [reward] = await db
    .select()
    .from(rewards)
    .where(isType ? eq(rewards.type, rewardIdOrType as 'daily') : eq(rewards.id, rewardIdOrType))
  if (!reward || !reward.isActive) throw Errors.notFound('Награда не найдена')

  const result = await db.transaction(async (tx) => {
    await lockUser(tx, userId)
    if (reward.type === 'referral') {
      const pending = await pendingReferrals(userId, reward.id, tx)
      if (pending.length === 0) throw Errors.conflict('Нет доступных реферальных наград', 'NOTHING_TO_CLAIM')
      const inserted = await tx
        .insert(rewardClaims)
        .values(pending.map((p) => ({ userId, rewardId: reward.id, periodKey: `ref:${p.id}`, amount: reward.amount })))
        .onConflictDoNothing()
        .returning({ id: rewardClaims.id })
      if (inserted.length === 0) throw Errors.conflict('Награда уже получена', 'ALREADY_CLAIMED')
      const amount = toMoney(D(reward.amount).mul(inserted.length))
      const r = await applyBalanceChange(tx, {
        userId,
        type: 'bonus',
        amount,
        referenceType: 'reward_claim',
        referenceId: inserted[0].id,
        meta: { reward: 'referral', count: inserted.length, title: reward.title },
      })
      return { amount, balance: r.balanceAfter, nextAt: null as string | null }
    }

    const deposited = await depositTotal(userId, tx)
    if (D(deposited).lt(reward.minDepositTotal)) {
      throw Errors.conflict(`Для получения нужно пополнить баланс минимум на $${reward.minDepositTotal}`, 'REQUIREMENT_NOT_MET')
    }
    const { periodKey, nextAt } = rewardWindow(reward.type, reward.cooldownSeconds)
    // UNIQUE(user_id, reward_id, period_key) — a replayed/parallel request cannot claim twice.
    const inserted = await tx
      .insert(rewardClaims)
      .values({ userId, rewardId: reward.id, periodKey, amount: reward.amount })
      .onConflictDoNothing()
      .returning({ id: rewardClaims.id })
    if (inserted.length === 0) throw Errors.conflict('Награда уже получена. Приходите позже.', 'ALREADY_CLAIMED')
    const r = await applyBalanceChange(tx, {
      userId,
      type: 'bonus',
      amount: reward.amount,
      referenceType: 'reward_claim',
      referenceId: inserted[0].id,
      meta: { reward: reward.type, title: reward.title },
    })
    return { amount: reward.amount, balance: r.balanceAfter, nextAt: nextAt.toISOString() }
  })
  void logEvent('reward_claim', { userId, ip, details: { reward: reward.type, amount: result.amount } })
  return result
}

export async function rewardHistory(userId: string, limit = 20) {
  return getDb()
    .select({ id: rewardClaims.id, amount: rewardClaims.amount, createdAt: rewardClaims.createdAt, type: rewards.type, title: rewards.title })
    .from(rewardClaims)
    .innerJoin(rewards, eq(rewards.id, rewardClaims.rewardId))
    .where(eq(rewardClaims.userId, userId))
    .orderBy(desc(rewardClaims.createdAt))
    .limit(limit)
}
