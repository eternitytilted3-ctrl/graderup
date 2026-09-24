import 'server-only'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { caseOpenings, items, payments, transactions, upgrades, userItems, users, type TransactionType } from '../db/schema'
import { Errors } from '../http/errors'
import { paginate, toItemDTO, toPublicUser } from './mappers'

export async function getProfile(userId: string) {
  const db = getDb()
  const [u] = await db.select().from(users).where(eq(users.id, userId))
  if (!u) throw Errors.notFound()
  const [[opened], [upg], [inv], [dep], [best], [referred]] = await Promise.all([
    db.select({ n: count() }).from(caseOpenings).where(eq(caseOpenings.userId, userId)),
    db
      .select({ n: count(), wins: sql<number>`count(*) filter (where ${upgrades.result} = 'win')::int` })
      .from(upgrades)
      .where(eq(upgrades.userId, userId)),
    db
      .select({ n: count(), value: sql<string>`coalesce(sum(${items.price}),0)::numeric(18,2)::text` })
      .from(userItems)
      .innerJoin(items, eq(items.id, userItems.itemId))
      .where(and(eq(userItems.userId, userId), eq(userItems.status, 'available'))),
    db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}),0)::numeric(18,2)::text` })
      .from(payments)
      .where(and(eq(payments.userId, userId), eq(payments.status, 'completed'))),
    db
      .select({ item: items })
      .from(userItems)
      .innerJoin(items, eq(items.id, userItems.itemId))
      .where(eq(userItems.userId, userId))
      .orderBy(desc(items.price))
      .limit(1),
    db.select({ n: count() }).from(users).where(eq(users.referredBy, userId)),
  ])
  return {
    user: toPublicUser(u),
    stats: {
      casesOpened: opened?.n ?? 0,
      upgrades: upg?.n ?? 0,
      upgradeWins: upg?.wins ?? 0,
      inventoryCount: inv?.n ?? 0,
      inventoryValue: inv?.value ?? '0.00',
      totalDeposited: dep?.total ?? '0.00',
      referrals: referred?.n ?? 0,
      bestDrop: best ? toItemDTO(best.item) : null,
    },
  }
}

export const HISTORY_FILTERS = {
  all: null,
  case_open: ['case_open'],
  upgrade: ['upgrade'],
  sell: ['item_sell'],
  deposit: ['deposit'],
  withdraw: ['withdraw'],
  reward: ['bonus'],
  other: ['refund', 'admin_adjustment'],
} as const satisfies Record<string, readonly TransactionType[] | null>

export type HistoryFilter = keyof typeof HISTORY_FILTERS

export async function getHistory(userId: string, opts: { page: number; pageSize: number; type: HistoryFilter }) {
  const db = getDb()
  const types = HISTORY_FILTERS[opts.type]
  const where = types ? and(eq(transactions.userId, userId), inArray(transactions.type, [...types])) : eq(transactions.userId, userId)
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.createdAt), desc(transactions.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(transactions).where(where),
  ])
  return paginate(
    rows.map((t) => {
      const meta = (t.meta ?? {}) as Record<string, unknown>
      return {
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        itemName: (meta.itemName as string | undefined) ?? null,
        rarity: (meta.rarity as string | undefined) ?? null,
        details: summarize(t.type, meta),
      }
    }),
    total,
    opts.page,
    opts.pageSize,
  )
}

function summarize(type: TransactionType, meta: Record<string, unknown>): string | null {
  switch (type) {
    case 'case_open':
      return meta.caseName ? `Кейс «${meta.caseName}»` : null
    case 'upgrade':
      return meta.sourceItemName ? `${meta.sourceItemName} → ${meta.targetItemName} · ${meta.chance}% · ${meta.result === 'win' ? 'успех' : 'неудача'}` : null
    case 'bonus':
      return (meta.title as string) ?? (meta.promocode ? `Промокод ${meta.promocode}` : meta.reason === 'referral_welcome' ? 'Бонус за приглашение' : 'Бонус')
    case 'admin_adjustment':
      return (meta.reason as string) ?? 'Корректировка'
    case 'refund':
      return (meta.reason as string) ?? 'Возврат'
    default:
      return null
  }
}
