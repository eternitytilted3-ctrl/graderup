import 'server-only'
import { and, count, desc, eq, gte, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import { D, toMoney } from '@/lib/money'
import type { Rarity } from '@/lib/types'
import { getDb } from '../db/client'
import {
  caseCategories,
  adminLogs,
  caseItems,
  caseOpenings,
  cases,
  eventLogs,
  items,
  payments,
  promocodes,
  rewards,
  sessions,
  transactions,
  upgrades,
  userItems,
  users,
  withdrawals,
  type UserRole,
} from '../db/schema'
import { Errors } from '../http/errors'
import { applyBalanceChange } from './ledger'
import { logAdmin } from './log'
import { paginate, toItemDTO, toPublicUser } from './mappers'
import { setSetting, type SettingKey } from './settings'

const like = (s: string) => `%${s.replace(/[%_\\]/g, '\\$&')}%`

// ─── Dashboard ───────────────────────────────────────────────────────────
export async function dashboard() {
  const db = getDb()
  const dayAgo = sql`now() - interval '24 hours'`
  const [
    [u],
    [u24],
    [online],
    [rev],
    [opened],
    [opened24],
    [upg],
    [dep],
    [wd],
    [tx],
    daily,
  ] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(gte(users.createdAt, dayAgo)),
    db
      .select({ n: sql<number>`count(distinct ${sessions.userId})::int` })
      .from(sessions)
      .where(gte(sessions.lastSeenAt, sql`now() - interval '5 minutes'`)),
    db
      .select({
        caseRevenue: sql<string>`coalesce(sum(${caseOpenings.price}),0)::numeric(18,2)::text`,
        itemsValue: sql<string>`coalesce(sum(${items.price}),0)::numeric(18,2)::text`,
      })
      .from(caseOpenings)
      .innerJoin(items, eq(items.id, caseOpenings.itemId)),
    db.select({ n: count() }).from(caseOpenings),
    db.select({ n: count() }).from(caseOpenings).where(gte(caseOpenings.createdAt, dayAgo)),
    db.select({ n: count(), wins: sql<number>`count(*) filter (where ${upgrades.result}='win')::int` }).from(upgrades),
    db
      .select({ n: count(), sum: sql<string>`coalesce(sum(${payments.amount}),0)::numeric(18,2)::text` })
      .from(payments)
      .where(eq(payments.status, 'completed')),
    db
      .select({
        n: count(),
        pending: sql<number>`count(*) filter (where ${withdrawals.status}='pending')::int`,
        sum: sql<string>`coalesce(sum(${withdrawals.amount}) filter (where ${withdrawals.status}='completed'),0)::numeric(18,2)::text`,
      })
      .from(withdrawals),
    db.select({ n: count() }).from(transactions),
    db.execute<{ day: string; deposits: string; openings: number }>(sql`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE((SELECT sum(amount) FROM payments p WHERE p.status='completed' AND date_trunc('day', p.completed_at)=d.day),0)::numeric(18,2)::text AS deposits,
        (SELECT count(*) FROM case_openings o WHERE date_trunc('day', o.created_at)=d.day)::int AS openings
      FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d(day)
      ORDER BY d.day`),
  ])
  return {
    users: u.n,
    newUsers24h: u24.n,
    usersOnline: online.n,
    revenue: {
      caseRevenue: rev.caseRevenue,
      itemsPaidOut: rev.itemsValue,
      ggr: toMoney(D(rev.caseRevenue).minus(rev.itemsValue)),
    },
    casesOpened: opened.n,
    casesOpened24h: opened24.n,
    upgrades: upg.n,
    upgradeWins: upg.wins,
    deposits: { count: dep.n, sum: dep.sum },
    withdrawals: { count: wd.n, pending: wd.pending, sum: wd.sum },
    transactions: tx.n,
    daily: daily.rows,
  }
}

// ─── Users ───────────────────────────────────────────────────────────────
export async function searchUsers(opts: { q?: string; page: number; pageSize: number }) {
  const db = getDb()
  const conds: SQL[] = []
  if (opts.q) {
    const q = opts.q.trim()
    const c = or(ilike(users.username, like(q)), ilike(users.email, like(q)), /^[0-9a-f-]{36}$/i.test(q) ? eq(users.id, q) : undefined)
    if (c) conds.push(c)
  }
  const where = conds.length ? and(...conds) : undefined
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(users).where(where),
  ])
  return paginate(
    rows.map((u) => ({ ...toPublicUser(u), isBanned: u.isBanned, lastLoginAt: u.lastLoginAt?.toISOString() ?? null })),
    total,
    opts.page,
    opts.pageSize,
  )
}

export async function userDetail(userId: string) {
  const db = getDb()
  const [u] = await db.select().from(users).where(eq(users.id, userId))
  if (!u) throw Errors.notFound('Пользователь не найден')
  const [inv, txs, [opened], [upg], [dep]] = await Promise.all([
    db
      .select({ ui: userItems, item: items })
      .from(userItems)
      .innerJoin(items, eq(items.id, userItems.itemId))
      .where(eq(userItems.userId, userId))
      .orderBy(desc(userItems.createdAt))
      .limit(100),
    db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt)).limit(100),
    db.select({ n: count() }).from(caseOpenings).where(eq(caseOpenings.userId, userId)),
    db.select({ n: count() }).from(upgrades).where(eq(upgrades.userId, userId)),
    db
      .select({ sum: sql<string>`coalesce(sum(${payments.amount}),0)::numeric(18,2)::text` })
      .from(payments)
      .where(and(eq(payments.userId, userId), eq(payments.status, 'completed'))),
  ])
  return {
    user: {
      ...toPublicUser(u),
      isBanned: u.isBanned,
      banReason: u.banReason,
      kycStatus: u.kycStatus,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    },
    stats: { casesOpened: opened.n, upgrades: upg.n, deposited: dep.sum },
    inventory: inv.map((r) => ({ id: r.ui.id, status: r.ui.status, source: r.ui.source, createdAt: r.ui.createdAt.toISOString(), item: toItemDTO(r.item) })),
    transactions: txs.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      status: t.status,
      referenceType: t.referenceType,
      createdAt: t.createdAt.toISOString(),
      meta: t.meta,
    })),
  }
}

export async function setBan(adminId: string, userId: string, banned: boolean, reason: string | undefined, ip?: string) {
  if (adminId === userId) throw Errors.badRequest('Нельзя заблокировать самого себя')
  return getDb().transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).for('update')
    if (!target) throw Errors.notFound('Пользователь не найден')
    if (target.role === 'superadmin') throw Errors.forbidden('Нельзя заблокировать суперадминистратора')
    await tx
      .update(users)
      .set({ isBanned: banned, banReason: banned ? (reason ?? null) : null, updatedAt: new Date() })
      .where(eq(users.id, userId))
    // Ban revokes all active sessions immediately.
    if (banned) await tx.delete(sessions).where(eq(sessions.userId, userId))
    await logAdmin(tx, { adminId, action: banned ? 'user_ban' : 'user_unban', targetType: 'user', targetId: userId, details: { reason }, ip })
    return { id: userId, isBanned: banned }
  })
}

/** Balance change by an admin: always an admin_adjustment transaction + admin log, in one DB transaction. */
export async function adjustBalance(adminId: string, userId: string, amount: string, reason: string, ip?: string) {
  if (D(amount).isZero()) throw Errors.badRequest('Сумма не может быть нулевой')
  return getDb().transaction(async (tx) => {
    const r = await applyBalanceChange(tx, {
      userId,
      type: 'admin_adjustment',
      amount,
      referenceType: 'admin',
      referenceId: adminId,
      meta: { reason, adminId },
      allowBanned: true,
    })
    await logAdmin(tx, {
      adminId,
      action: 'balance_adjust',
      targetType: 'user',
      targetId: userId,
      details: { amount: toMoney(amount), reason, before: r.balanceBefore, after: r.balanceAfter, transactionId: r.transaction.id },
      ip,
    })
    return { balance: r.balanceAfter, transactionId: r.transaction.id }
  })
}

export async function setRole(adminId: string, userId: string, role: UserRole, ip?: string) {
  if (adminId === userId) throw Errors.badRequest('Нельзя изменить собственную роль')
  return getDb().transaction(async (tx) => {
    const [u] = await tx.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id })
    if (!u) throw Errors.notFound('Пользователь не найден')
    await logAdmin(tx, { adminId, action: 'role_change', targetType: 'user', targetId: userId, details: { role }, ip })
    return { id: userId, role }
  })
}

export async function listAdmins() {
  const rows = await getDb().select().from(users).where(inArray(users.role, ['admin', 'superadmin'])).orderBy(users.createdAt)
  return rows.map((u) => ({ ...toPublicUser(u), lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))
}

// ─── Items ───────────────────────────────────────────────────────────────
export interface ItemInput {
  name: string
  image: string
  price: number
  rarity: Rarity
  description?: string
  isActive?: boolean
  marketHashName?: string | null
  priceLocked?: boolean
}

export async function listItemsAdmin(opts: { q?: string; rarity?: Rarity; page: number; pageSize: number }) {
  const db = getDb()
  const conds: SQL[] = []
  if (opts.q) conds.push(ilike(items.name, like(opts.q)))
  if (opts.rarity) conds.push(eq(items.rarity, opts.rarity))
  const where = conds.length ? and(...conds) : undefined
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(items)
      .where(where)
      .orderBy(desc(items.price))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(items).where(where),
  ])
  return paginate(
    rows.map((i) => ({
      ...toItemDTO(i, true),
      isActive: i.isActive,
      marketHashName: i.marketHashName,
      marketPrice: i.marketPrice,
      priceSource: i.priceSource,
      priceUpdatedAt: i.priceUpdatedAt?.toISOString() ?? null,
      priceLocked: i.priceLocked,
    })),
    total,
    opts.page,
    opts.pageSize,
  )
}

export async function saveItem(adminId: string, id: string | null, input: ItemInput, ip?: string) {
  const values = {
    name: input.name,
    image: input.image,
    price: toMoney(input.price),
    rarity: input.rarity,
    description: input.description ?? '',
    isActive: input.isActive ?? true,
    marketHashName: input.marketHashName || null,
    priceLocked: input.priceLocked ?? false,
  }
  return getDb().transaction(async (tx) => {
    if (values.marketHashName) {
      const [dup] = await tx.select({ id: items.id }).from(items).where(eq(items.marketHashName, values.marketHashName))
      if (dup && dup.id !== id) throw Errors.validation({ fields: { marketHashName: 'Уже привязан к другому предмету' } })
    }
    let row
    if (id) {
      ;[row] = await tx
        .update(items)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(items.id, id))
        .returning()
      if (!row) throw Errors.notFound('Предмет не найден')
    } else {
      ;[row] = await tx.insert(items).values(values).returning()
    }
    await logAdmin(tx, { adminId, action: id ? 'item_update' : 'item_create', targetType: 'item', targetId: row.id, details: values, ip })
    return { ...toItemDTO(row, true), isActive: row.isActive }
  })
}

// ─── Cases ───────────────────────────────────────────────────────────────
export interface CaseInput {
  name: string
  slug: string
  description?: string
  image: string
  price: number
  status: 'active' | 'disabled'
  sortOrder?: number
  isFeatured?: boolean
  categoryId?: string | null
}

export async function caseForEdit(caseId: string) {
  const db = getDb()
  const [c] = await db.select().from(cases).where(eq(cases.id, caseId))
  if (!c) throw Errors.notFound('Кейс не найден')
  const entries = await db
    .select({ ci: caseItems, item: items })
    .from(caseItems)
    .innerJoin(items, eq(items.id, caseItems.itemId))
    .where(eq(caseItems.caseId, caseId))
    .orderBy(desc(items.price))
  return {
    case: { ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() },
    items: entries.map((e) => ({ item: { ...toItemDTO(e.item), isActive: e.item.isActive }, dropWeight: e.ci.dropWeight, dropChance: e.ci.dropChance })),
  }
}

export async function saveCase(adminId: string, id: string | null, input: CaseInput, ip?: string) {
  const values = {
    name: input.name,
    slug: input.slug.toLowerCase(),
    description: input.description ?? '',
    image: input.image,
    price: toMoney(input.price),
    status: input.status,
    sortOrder: input.sortOrder ?? 0,
    isFeatured: input.isFeatured ?? false,
    categoryId: input.categoryId || null,
  }
  return getDb().transaction(async (tx) => {
    const [dup] = await tx.select({ id: cases.id }).from(cases).where(eq(cases.slug, values.slug))
    if (dup && dup.id !== id) throw Errors.validation({ fields: { slug: 'Slug уже используется' } })
    let row
    if (id) {
      ;[row] = await tx
        .update(cases)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(cases.id, id))
        .returning()
      if (!row) throw Errors.notFound('Кейс не найден')
    } else {
      ;[row] = await tx.insert(cases).values(values).returning()
    }
    await logAdmin(tx, { adminId, action: id ? 'case_update' : 'case_create', targetType: 'case', targetId: row.id, details: values, ip })
    return row
  })
}

/** Replaces the case's item list. Weights are integers; drop_chance is recomputed from them (always sums to 100%). */
export async function setCaseItems(adminId: string, caseId: string, entries: { itemId: string; dropWeight: number }[], ip?: string) {
  const ids = entries.map((e) => e.itemId)
  if (new Set(ids).size !== ids.length) throw Errors.badRequest('Предметы в кейсе не должны повторяться')
  return getDb().transaction(async (tx) => {
    const [c] = await tx.select().from(cases).where(eq(cases.id, caseId)).for('update')
    if (!c) throw Errors.notFound('Кейс не найден')
    if (ids.length) {
      const found = await tx.select({ id: items.id }).from(items).where(inArray(items.id, ids))
      if (found.length !== ids.length) throw Errors.badRequest('Некоторые предметы не найдены')
    }
    const total = entries.reduce((s, e) => s + e.dropWeight, 0)
    await tx.delete(caseItems).where(eq(caseItems.caseId, caseId))
    if (entries.length) {
      await tx.insert(caseItems).values(
        entries.map((e) => ({
          caseId,
          itemId: e.itemId,
          dropWeight: e.dropWeight,
          dropChance: D(e.dropWeight).div(total).mul(100).toDecimalPlaces(5).toString(),
        })),
      )
    }
    await tx.update(cases).set({ updatedAt: new Date() }).where(eq(cases.id, caseId))
    await logAdmin(tx, { adminId, action: 'case_items_update', targetType: 'case', targetId: caseId, details: { entries, totalWeight: total }, ip })
    return { count: entries.length, totalWeight: total }
  })
}

// ─── Rewards / promocodes ────────────────────────────────────────────────
export async function listRewardsAdmin() {
  return getDb().select().from(rewards).orderBy(rewards.type)
}

export async function updateReward(
  adminId: string,
  id: string,
  input: { title: string; description: string; amount: number; cooldownSeconds: number; minDepositTotal: number; isActive: boolean },
  ip?: string,
) {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .update(rewards)
      .set({
        title: input.title,
        description: input.description,
        amount: toMoney(input.amount),
        cooldownSeconds: input.cooldownSeconds,
        minDepositTotal: toMoney(input.minDepositTotal),
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(eq(rewards.id, id))
      .returning()
    if (!row) throw Errors.notFound('Награда не найдена')
    await logAdmin(tx, { adminId, action: 'reward_update', targetType: 'reward', targetId: id, details: input, ip })
    return row
  })
}

export async function listPromocodesAdmin() {
  const rows = await getDb().select({ p: promocodes, itemName: items.name }).from(promocodes).leftJoin(items, eq(items.id, promocodes.itemId)).orderBy(desc(promocodes.createdAt))
  return rows.map((r) => ({ ...r.p, itemName: r.itemName, expiresAt: r.p.expiresAt?.toISOString() ?? null, createdAt: r.p.createdAt.toISOString() }))
}

export async function savePromocode(
  adminId: string,
  id: string | null,
  input: { code: string; type: 'fixed' | 'percentage' | 'item'; value: number; itemId?: string | null; maxUses: number; expiresAt?: string | null; active: boolean },
  ip?: string,
) {
  if (input.type === 'item' && !input.itemId) throw Errors.validation({ fields: { itemId: 'Выберите предмет' } })
  if (input.type === 'percentage' && (input.value <= 0 || input.value > 100)) throw Errors.validation({ fields: { value: 'Процент от 0 до 100' } })
  if (input.type === 'fixed' && input.value <= 0) throw Errors.validation({ fields: { value: 'Сумма должна быть больше 0' } })
  const values = {
    code: input.code.trim().toUpperCase(),
    type: input.type,
    value: toMoney(input.type === 'item' ? 0 : input.value),
    itemId: input.type === 'item' ? input.itemId! : null,
    maxUses: input.maxUses,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    active: input.active,
  }
  return getDb().transaction(async (tx) => {
    const [dup] = await tx.select({ id: promocodes.id }).from(promocodes).where(sql`upper(${promocodes.code}) = ${values.code}`)
    if (dup && dup.id !== id) throw Errors.validation({ fields: { code: 'Такой промокод уже существует' } })
    let row
    if (id) {
      ;[row] = await tx
        .update(promocodes)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(promocodes.id, id))
        .returning()
      if (!row) throw Errors.notFound('Промокод не найден')
      if (row.usedCount > row.maxUses) throw Errors.validation({ fields: { maxUses: 'Меньше, чем уже использовано' } })
    } else {
      ;[row] = await tx.insert(promocodes).values(values).returning()
    }
    await logAdmin(tx, { adminId, action: id ? 'promocode_update' : 'promocode_create', targetType: 'promocode', targetId: row.id, details: { ...values, expiresAt: input.expiresAt }, ip })
    return row
  })
}

// ─── Lists ───────────────────────────────────────────────────────────────
export async function listPaymentsAdmin(opts: { page: number; pageSize: number; status?: string }) {
  const db = getDb()
  const where = opts.status ? eq(payments.status, opts.status as 'pending') : undefined
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ p: payments, username: users.username })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(payments).where(where),
  ])
  return paginate(
    rows.map((r) => ({
      id: r.p.id,
      userId: r.p.userId,
      username: r.username,
      provider: r.p.provider,
      externalId: r.p.externalId,
      amount: r.p.amount,
      bonusAmount: r.p.bonusAmount,
      status: r.p.status,
      createdAt: r.p.createdAt.toISOString(),
      completedAt: r.p.completedAt?.toISOString() ?? null,
    })),
    total,
    opts.page,
    opts.pageSize,
  )
}

export async function listWithdrawalsAdmin(opts: { page: number; pageSize: number; status?: string }) {
  const db = getDb()
  const where = opts.status ? eq(withdrawals.status, opts.status as 'pending') : undefined
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ w: withdrawals, username: users.username, kycStatus: users.kycStatus })
      .from(withdrawals)
      .innerJoin(users, eq(users.id, withdrawals.userId))
      .where(where)
      .orderBy(desc(withdrawals.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(withdrawals).where(where),
  ])
  return paginate(
    rows.map((r) => ({
      ...r.w,
      username: r.username,
      kycStatus: r.kycStatus,
      createdAt: r.w.createdAt.toISOString(),
      processedAt: r.w.processedAt?.toISOString() ?? null,
      updatedAt: undefined,
    })),
    total,
    opts.page,
    opts.pageSize,
  )
}

export async function listTransactionsAdmin(opts: { page: number; pageSize: number; type?: string; userId?: string }) {
  const db = getDb()
  const conds: SQL[] = []
  if (opts.type) conds.push(eq(transactions.type, opts.type as 'deposit'))
  if (opts.userId) conds.push(eq(transactions.userId, opts.userId))
  const where = conds.length ? and(...conds) : undefined
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ t: transactions, username: users.username })
      .from(transactions)
      .innerJoin(users, eq(users.id, transactions.userId))
      .where(where)
      .orderBy(desc(transactions.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(transactions).where(where),
  ])
  return paginate(
    rows.map((r) => ({ ...r.t, username: r.username, createdAt: r.t.createdAt.toISOString() })),
    total,
    opts.page,
    opts.pageSize,
  )
}

export async function listLogs(opts: { page: number; pageSize: number; kind: 'admin' | 'events'; level?: string; q?: string }) {
  const db = getDb()
  if (opts.kind === 'admin') {
    const where = opts.q ? ilike(adminLogs.action, like(opts.q)) : undefined
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({ l: adminLogs, username: users.username })
        .from(adminLogs)
        .leftJoin(users, eq(users.id, adminLogs.adminId))
        .where(where)
        .orderBy(desc(adminLogs.id))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize),
      db.select({ total: count() }).from(adminLogs).where(where),
    ])
    return paginate(
      rows.map((r) => ({ ...r.l, username: r.username, createdAt: r.l.createdAt.toISOString() })),
      total,
      opts.page,
      opts.pageSize,
    )
  }
  const conds: SQL[] = []
  if (opts.level) conds.push(eq(eventLogs.level, opts.level as 'info'))
  if (opts.q) conds.push(ilike(eventLogs.event, like(opts.q)))
  const where = conds.length ? and(...conds) : undefined
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ l: eventLogs, username: users.username })
      .from(eventLogs)
      .leftJoin(users, eq(users.id, eventLogs.userId))
      .where(where)
      .orderBy(desc(eventLogs.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(eventLogs).where(where),
  ])
  return paginate(
    rows.map((r) => ({ ...r.l, username: r.username, createdAt: r.l.createdAt.toISOString() })),
    total,
    opts.page,
    opts.pageSize,
  )
}

export async function updateSettings(adminId: string, key: SettingKey, value: unknown, ip?: string) {
  return getDb().transaction(async (tx) => {
    const saved = await setSetting(tx, key, value, adminId)
    await logAdmin(tx, { adminId, action: 'settings_update', targetType: 'setting', targetId: key, details: { value: saved }, ip })
    return saved
  })
}

// ─── Case categories ─────────────────────────────────────────────────────
export async function listCategories() {
  const db = getDb()
  const rows = await db
    .select({ c: caseCategories, cases: sql<number>`(select count(*)::int from cases where cases.category_id = ${caseCategories.id})` })
    .from(caseCategories)
    .orderBy(caseCategories.sortOrder, caseCategories.name)
  return rows.map((r) => ({ ...r.c, createdAt: r.c.createdAt.toISOString(), caseCount: r.cases }))
}

export async function saveCategory(
  adminId: string,
  id: string | null,
  input: { name: string; slug: string; sortOrder: number; isActive: boolean },
  ip?: string,
) {
  return getDb().transaction(async (tx) => {
    const [dup] = await tx.select({ id: caseCategories.id }).from(caseCategories).where(eq(caseCategories.slug, input.slug))
    if (dup && dup.id !== id) throw Errors.validation({ fields: { slug: 'Slug уже используется' } })
    let row
    if (id) {
      ;[row] = await tx.update(caseCategories).set(input).where(eq(caseCategories.id, id)).returning()
      if (!row) throw Errors.notFound('Категория не найдена')
    } else {
      ;[row] = await tx.insert(caseCategories).values(input).returning()
    }
    await logAdmin(tx, { adminId, action: id ? 'category_update' : 'category_create', targetType: 'case_category', targetId: row.id, details: input, ip })
    return row
  })
}

export async function deleteCategory(adminId: string, id: string, ip?: string) {
  return getDb().transaction(async (tx) => {
    const [row] = await tx.delete(caseCategories).where(eq(caseCategories.id, id)).returning()
    if (!row) throw Errors.notFound('Категория не найдена')
    await logAdmin(tx, { adminId, action: 'category_delete', targetType: 'case_category', targetId: id, details: { name: row.name }, ip })
    return { ok: true }
  })
}
