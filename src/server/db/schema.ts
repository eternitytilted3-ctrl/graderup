import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

/** Money columns: NUMERIC(18,2). Never use float for money. Drizzle returns them as strings. */
const money = (name: string) => numeric(name, { precision: 18, scale: 2 })
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

// ─── Enums ───────────────────────────────────────────────────────────────
export const userRole = pgEnum('user_role', ['user', 'admin', 'superadmin'])
export const rarity = pgEnum('rarity', ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'])
export const caseStatus = pgEnum('case_status', ['active', 'disabled'])
export const userItemStatus = pgEnum('user_item_status', ['available', 'locked', 'sold', 'used', 'withdrawn'])
export const userItemSource = pgEnum('user_item_source', ['case', 'upgrade', 'reward', 'promocode', 'admin'])
export const transactionType = pgEnum('transaction_type', [
  'deposit',
  'withdraw',
  'case_open',
  'item_sell',
  'upgrade',
  'bonus',
  'refund',
  'admin_adjustment',
])
export const transactionStatus = pgEnum('transaction_status', ['pending', 'completed', 'failed', 'reversed'])
export const upgradeResult = pgEnum('upgrade_result', ['win', 'loss'])
export const paymentStatus = pgEnum('payment_status', ['pending', 'completed', 'failed', 'cancelled', 'expired'])
export const withdrawalStatus = pgEnum('withdrawal_status', ['pending', 'approved', 'rejected', 'completed'])
export const itemWithdrawalStatus = pgEnum('item_withdrawal_status', ['searching', 'waiting_accept', 'completed', 'failed', 'cancelled'])
export const rewardType = pgEnum('reward_type', ['daily', 'weekly', 'referral'])
export const promocodeType = pgEnum('promocode_type', ['fixed', 'percentage', 'item'])
export const logLevel = pgEnum('log_level', ['info', 'warn', 'error', 'security'])

// ─── Users & auth ────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 32 }).notNull(),
    email: varchar('email', { length: 254 }),
    passwordHash: text('password_hash'),
    avatarUrl: text('avatar_url'),
    role: userRole('role').notNull().default('user'),
    balance: money('balance').notNull().default('0'),
    isBanned: boolean('is_banned').notNull().default(false),
    banReason: text('ban_reason'),
    referralCode: varchar('referral_code', { length: 16 }).notNull(),
    referredBy: uuid('referred_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    /** Pending % bonus (from percentage promocode) applied to the next deposit. */
    depositBonusPercent: numeric('deposit_bonus_percent', { precision: 5, scale: 2 }).notNull().default('0'),
    kycStatus: varchar('kyc_status', { length: 16 }).notNull().default('none'),
    /** Steam trade offer URL for skin withdrawals. */
    steamTradeUrl: varchar('steam_trade_url', { length: 256 }),
    birthDate: timestamp('birth_date', { withTimezone: false, mode: 'string' }),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_username_lower_uq').on(sql`lower(${t.username})`),
    uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`),
    uniqueIndex('users_referral_code_uq').on(t.referralCode),
    index('users_created_at_idx').on(t.createdAt),
    index('users_referred_by_idx').on(t.referredBy),
    check('users_balance_non_negative', sql`${t.balance} >= 0`),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** sha256(token) — the raw token only lives in the httpOnly cookie. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    csrfToken: varchar('csrf_token', { length: 64 }).notNull(),
    ip: varchar('ip', { length: 64 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_uq').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
    index('sessions_last_seen_idx').on(t.lastSeenAt),
  ],
)

/** Links a user to an external identity (Steam etc). Email/password lives on users. */
export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    providerUserId: varchar('provider_user_id', { length: 128 }).notNull(),
    profile: jsonb('profile'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('auth_accounts_provider_uq').on(t.provider, t.providerUserId), index('auth_accounts_user_idx').on(t.userId)],
)

// ─── Catalog ─────────────────────────────────────────────────────────────
export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    image: text('image').notNull(),
    price: money('price').notNull(),
    rarity: rarity('rarity').notNull(),
    description: text('description').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    /** External market identifier (e.g. CS2 "AK-47 | Redline (Field-Tested)") used for price sync. */
    marketHashName: varchar('market_hash_name', { length: 200 }),
    /** Raw market price from the price provider, before markup. */
    marketPrice: numeric('market_price', { precision: 18, scale: 2 }),
    priceSource: varchar('price_source', { length: 32 }),
    priceUpdatedAt: timestamp('price_updated_at', { withTimezone: true }),
    /** When true, price sync never overwrites the manually set price. */
    priceLocked: boolean('price_locked').notNull().default(false),
    /** Skin name without exterior, e.g. "Glock-18 | Pink DDPAT" — groups wear variants of one skin. */
    baseName: varchar('base_name', { length: 200 }),
    /** Exterior: Factory New / Minimal Wear / Field-Tested / Well-Worn / Battle-Scarred (null = none). */
    wear: varchar('wear', { length: 32 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('items_market_hash_name_uq').on(t.marketHashName),
    index('items_base_name_idx').on(t.baseName),
    index('items_rarity_idx').on(t.rarity),
    index('items_price_idx').on(t.price),
    check('items_price_positive', sql`${t.price} > 0`),
  ],
)

export const caseCategories = pgTable(
  'case_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('case_categories_slug_uq').on(t.slug), index('case_categories_sort_idx').on(t.sortOrder)],
)

export const cases = pgTable(
  'cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: text('description').notNull().default(''),
    image: text('image').notNull(),
    price: money('price').notNull(),
    status: caseStatus('status').notNull().default('active'),
    sortOrder: integer('sort_order').notNull().default(0),
    isFeatured: boolean('is_featured').notNull().default(false),
    /** Card ribbon: limited | new | hot (null → HOT when featured). */
    badge: varchar('badge', { length: 16 }),
    /** Limited-time case: hidden and not openable after this moment. */
    endsAt: timestamp('ends_at', { withTimezone: true }),
    categoryId: uuid('category_id').references(() => caseCategories.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('cases_slug_uq').on(t.slug),
    index('cases_category_idx').on(t.categoryId),
    index('cases_status_idx').on(t.status, t.sortOrder),
    check('cases_price_positive', sql`${t.price} > 0`),
  ],
)

export const caseItems = pgTable(
  'case_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    /** Integer weight used by the server-side RNG. */
    dropWeight: integer('drop_weight').notNull(),
    /** Denormalized percentage (weight / total * 100) for display; recalculated on every edit. */
    dropChance: numeric('drop_chance', { precision: 9, scale: 5 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('case_items_case_item_uq').on(t.caseId, t.itemId),
    index('case_items_item_idx').on(t.itemId),
    check('case_items_weight_positive', sql`${t.dropWeight} > 0`),
  ],
)

// ─── Inventory & game operations ─────────────────────────────────────────
export const userItems = pgTable(
  'user_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    source: userItemSource('source').notNull(),
    sourceReference: uuid('source_reference'),
    status: userItemStatus('status').notNull().default('available'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('user_items_user_status_idx').on(t.userId, t.status, t.createdAt),
    index('user_items_item_idx').on(t.itemId),
  ],
)

export const caseOpenings = pgTable(
  'case_openings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'restrict' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    userItemId: uuid('user_item_id').references(() => userItems.id, { onDelete: 'set null' }),
    price: money('price').notNull(),
    roll: integer('roll').notNull(),
    totalWeight: integer('total_weight').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('case_openings_user_idx').on(t.userId, t.createdAt),
    index('case_openings_created_idx').on(t.createdAt),
    index('case_openings_case_idx').on(t.caseId),
  ],
)

export const upgrades = pgTable(
  'upgrades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** First source item (kept for compatibility); all sources are in upgrade_sources. */
    sourceUserItemId: uuid('source_user_item_id')
      .notNull()
      .references(() => userItems.id, { onDelete: 'restrict' }),
    sourceItemId: uuid('source_item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    targetItemId: uuid('target_item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    resultUserItemId: uuid('result_user_item_id').references(() => userItems.id, { onDelete: 'set null' }),
    sourceValue: money('source_value').notNull(),
    targetValue: money('target_value').notNull(),
    /** Chance in percent, 0..100 with 4 decimals. */
    chance: numeric('chance', { precision: 7, scale: 4 }).notNull(),
    /** Roll in [0, 1_000_000). Win if roll < chance * 10_000. */
    roll: integer('roll').notNull(),
    result: upgradeResult('result').notNull(),
    /** Bonus zone (refund | double) decided with the roll; null when none appeared. */
    bonusType: varchar('bonus_type', { length: 16 }),
    bonusZoneStart: integer('bonus_zone_start'),
    bonusZoneSize: integer('bonus_zone_size'),
    bonusHit: boolean('bonus_hit').notNull().default(false),
    /** Coins returned by a refund zone hit. */
    bonusPayout: money('bonus_payout'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('upgrades_source_user_item_uq').on(t.sourceUserItemId),
    index('upgrades_user_idx').on(t.userId, t.createdAt),
  ],
)

/** Every inventory item consumed by an upgrade (1..5). UNIQUE(user_item_id): one item — one upgrade. */
export const upgradeSources = pgTable(
  'upgrade_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    upgradeId: uuid('upgrade_id')
      .notNull()
      .references(() => upgrades.id, { onDelete: 'cascade' }),
    userItemId: uuid('user_item_id')
      .notNull()
      .references(() => userItems.id, { onDelete: 'restrict' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    value: money('value').notNull(),
  },
  (t) => [uniqueIndex('upgrade_sources_user_item_uq').on(t.userItemId), index('upgrade_sources_upgrade_idx').on(t.upgradeId)],
)

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: transactionType('type').notNull(),
    amount: money('amount').notNull(),
    balanceBefore: money('balance_before').notNull(),
    balanceAfter: money('balance_after').notNull(),
    referenceType: varchar('reference_type', { length: 32 }),
    referenceId: uuid('reference_id'),
    status: transactionStatus('status').notNull().default('completed'),
    meta: jsonb('meta'),
    createdAt: createdAt(),
  },
  (t) => [
    index('transactions_user_idx').on(t.userId, t.createdAt),
    index('transactions_type_idx').on(t.type, t.createdAt),
    index('transactions_ref_idx').on(t.referenceType, t.referenceId),
  ],
)

// ─── Payments ────────────────────────────────────────────────────────────
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    externalId: varchar('external_id', { length: 128 }),
    amount: money('amount').notNull(),
    bonusAmount: money('bonus_amount').notNull().default('0'),
    currency: varchar('currency', { length: 8 }).notNull().default('USD'),
    status: paymentStatus('status').notNull().default('pending'),
    checkoutUrl: text('checkout_url'),
    rawPayload: jsonb('raw_payload'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('payments_provider_external_uq').on(t.provider, t.externalId),
    index('payments_user_idx').on(t.userId, t.createdAt),
    index('payments_status_idx').on(t.status, t.createdAt),
    check('payments_amount_positive', sql`${t.amount} > 0`),
  ],
)

export const withdrawals = pgTable(
  'withdrawals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: money('amount').notNull(),
    method: varchar('method', { length: 32 }).notNull(),
    destination: varchar('destination', { length: 256 }).notNull(),
    status: withdrawalStatus('status').notNull().default('pending'),
    adminNote: text('admin_note'),
    processedBy: uuid('processed_by').references(() => users.id, { onDelete: 'set null' }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('withdrawals_user_idx').on(t.userId, t.createdAt),
    index('withdrawals_status_idx').on(t.status, t.createdAt),
    check('withdrawals_amount_positive', sql`${t.amount} > 0`),
  ],
)

/** Skin withdrawals to Steam (delivered by a trade provider: marketplace bot / P2P). */
export const itemWithdrawals = pgTable(
  'item_withdrawals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userItemId: uuid('user_item_id')
      .notNull()
      .references(() => userItems.id, { onDelete: 'restrict' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    price: money('price').notNull(),
    tradeUrl: varchar('trade_url', { length: 256 }).notNull(),
    provider: varchar('provider', { length: 32 }).notNull(),
    externalId: varchar('external_id', { length: 128 }),
    tradeOfferId: varchar('trade_offer_id', { length: 64 }),
    status: itemWithdrawalStatus('status').notNull().default('searching'),
    statusMessage: text('status_message'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // An item can have at most one active/completed withdrawal; failed/cancelled ones free it again.
    index('item_withdrawals_user_idx').on(t.userId, t.createdAt),
    index('item_withdrawals_status_idx').on(t.status, t.createdAt),
    uniqueIndex('item_withdrawals_active_item_uq').on(t.userItemId).where(sql`status in ('searching','waiting_accept','completed')`),
  ],
)

// ─── Rewards & promo ─────────────────────────────────────────────────────
export const rewards = pgTable(
  'rewards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: rewardType('type').notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    description: text('description').notNull().default(''),
    amount: money('amount').notNull(),
    cooldownSeconds: integer('cooldown_seconds').notNull(),
    /** Min lifetime deposits required to claim (anti-abuse for multi-accounts). */
    minDepositTotal: money('min_deposit_total').notNull().default('0'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('rewards_type_uq').on(t.type)],
)

export const rewardClaims = pgTable(
  'reward_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rewardId: uuid('reward_id')
      .notNull()
      .references(() => rewards.id, { onDelete: 'restrict' }),
    /** e.g. "2026-09-24" for daily, "2026-W39" for weekly, referred user id for referral. */
    periodKey: varchar('period_key', { length: 64 }).notNull(),
    amount: money('amount').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('reward_claims_period_uq').on(t.userId, t.rewardId, t.periodKey),
    index('reward_claims_user_idx').on(t.userId, t.createdAt),
  ],
)

export const promocodes = pgTable(
  'promocodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 32 }).notNull(),
    type: promocodeType('type').notNull(),
    /** fixed: amount; percentage: percent (0..100]; item: unused (see itemId). */
    value: numeric('value', { precision: 18, scale: 2 }).notNull().default('0'),
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'restrict' }),
    maxUses: integer('max_uses').notNull(),
    usedCount: integer('used_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('promocodes_code_upper_uq').on(sql`upper(${t.code})`),
    check('promocodes_used_le_max', sql`${t.usedCount} <= ${t.maxUses}`),
  ],
)

export const promocodeUses = pgTable(
  'promocode_uses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    promocodeId: uuid('promocode_id')
      .notNull()
      .references(() => promocodes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('promocode_uses_uq').on(t.promocodeId, t.userId), index('promocode_uses_user_idx').on(t.userId)],
)

// ─── Audit / infra ───────────────────────────────────────────────────────
export const adminLogs = pgTable(
  'admin_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 32 }),
    targetId: varchar('target_id', { length: 64 }),
    details: jsonb('details'),
    ip: varchar('ip', { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [index('admin_logs_created_idx').on(t.createdAt), index('admin_logs_admin_idx').on(t.adminId)],
)

/** Application & security event log (registration, login, game ops, errors). */
export const eventLogs = pgTable(
  'event_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    level: logLevel('level').notNull().default('info'),
    event: varchar('event', { length: 64 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    ip: varchar('ip', { length: 64 }),
    details: jsonb('details'),
    createdAt: createdAt(),
  },
  (t) => [
    index('event_logs_created_idx').on(t.createdAt),
    index('event_logs_event_idx').on(t.event, t.createdAt),
    index('event_logs_user_idx').on(t.userId),
  ],
)

export const settings = pgTable('settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
})

export const rateLimits = pgTable(
  'rate_limits',
  {
    key: varchar('key', { length: 200 }).notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [uniqueIndex('rate_limits_pk').on(t.key, t.windowStart), index('rate_limits_window_idx').on(t.windowStart)],
)

/** Anonymous presence for the real "online" counter: random visitor id (gu_vid cookie) → last seen. */
export const presence = pgTable(
  'presence',
  {
    visitorId: varchar('visitor_id', { length: 32 }).primaryKey(),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('presence_seen_idx').on(t.seenAt)],
)

/** Stores responses of money-moving requests so a retried request returns the same result. */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 100 }).notNull(),
    scope: varchar('scope', { length: 64 }).notNull(),
    statusCode: integer('status_code'),
    response: jsonb('response'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('idempotency_keys_uq').on(t.userId, t.scope, t.key), index('idempotency_keys_created_idx').on(t.createdAt)],
)

export type Rarity = (typeof rarity.enumValues)[number]
export type TransactionType = (typeof transactionType.enumValues)[number]
export type UserRole = (typeof userRole.enumValues)[number]
