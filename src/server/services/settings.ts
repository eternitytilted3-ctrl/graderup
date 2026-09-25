import 'server-only'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, type Executor } from '../db/client'
import { settings } from '../db/schema'

/**
 * Runtime-configurable settings (editable in the admin panel). Every key has a zod schema
 * and a default, so a missing/invalid DB value never breaks the app.
 */
export const settingSchemas = {
  upgrade: z.object({
    /** Share of the ratio kept by the house, 0..0.5 (e.g. 0.05 = 5%). */
    houseEdge: z.number().min(0).max(0.5),
    /** Chance bounds in percent. */
    minChance: z.number().min(0.01).max(100),
    maxChance: z.number().min(0.01).max(100),
    /** Target price must be at least source × minMultiplier and at most source × maxMultiplier. */
    minMultiplier: z.number().min(1).max(1000),
    maxMultiplier: z.number().min(1).max(100000),
    /** Quick-pick buttons on the upgrade page: target = stake × N. */
    quickMultipliers: z.array(z.number().min(1.01).max(100000)).min(1).max(6).default([2, 5, 10]),
    /** Quick-pick buttons: target that gives ≈ N% chance. */
    quickChances: z.array(z.number().min(0.01).max(100)).min(1).max(6).default([30, 50, 75]),
    /** Coins from the balance a player may add to the stake (0 = disabled). */
    maxBalanceStake: z.number().min(0).max(10_000_000).default(100000),
  }),
  upgradeBonus: z.object({
    enabled: z.boolean(),
    /** A bonus zone appears once per cycle of minInterval..maxInterval upgrades (random spin inside). */
    minInterval: z.number().int().min(1).max(1000).default(6),
    maxInterval: z.number().int().min(1).max(1000).default(15),
    /** Upgrades with a stake above this (coins) get no bonus zone and do not advance the cycle. */
    maxStake: z.number().min(0).max(10_000_000).default(5000),
    /** Zone width, % of the dial. */
    zonePercent: z.number().min(0.5).max(20),
    /** Refund zone: share of the stake returned, % (lose 50–70% → 30..50). */
    refundMinPercent: z.number().min(0).max(100),
    refundMaxPercent: z.number().min(0).max(100),
    /** Share of zones that are ×2 (target granted twice) instead of refund, %. */
    doubleSharePercent: z.number().min(0).max(100),
    /** ×2 zones only for upgrades up to this multiplier. */
    doubleMaxMultiplier: z.number().min(1).max(1000),
  }),
  inventory: z.object({
    /** Sell price = item price × sellRatio. */
    sellRatio: z.number().min(0.1).max(1),
  }),
  deposit: z.object({
    minAmount: z.number().positive(),
    maxAmount: z.number().positive(),
    presets: z.array(z.number().positive()).max(8),
    currency: z.string().length(3),
  }),
  withdraw: z.object({
    enabled: z.boolean(),
    minAmount: z.number().positive(),
    maxAmount: z.number().positive(),
    methods: z.array(z.string().min(1).max(32)).min(1).max(8),
    /** Max withdrawal requests per user per rolling 24h (pending ones included). */
    perDay: z.number().int().min(1).max(100).default(1),
  }),
  skinWithdraw: z.object({
    enabled: z.boolean(),
    /** Max simultaneous active skin withdrawals per user. */
    maxActive: z.number().int().min(1).max(20),
  }),
  cases: z.object({
    /** Target return-to-player used when (re)balancing case weights: 0.5..0.99. */
    rtp: z.number().min(0.3).max(0.99),
    /** Show drop chances / prices / exterior of case contents to players. */
    showOdds: z.boolean(),
  }),
  drops: z.object({
    /** Relative weights of exteriors rolled after the skin is chosen (renormalised over the wears that exist). */
    wearWeights: z.object({
      'Factory New': z.number().min(0),
      'Minimal Wear': z.number().min(0),
      'Field-Tested': z.number().min(0),
      'Well-Worn': z.number().min(0),
      'Battle-Scarred': z.number().min(0),
    }),
  }),
  referral: z.object({
    /** Bonus the invited user receives on first deposit, percent. */
    inviteeBonusPercent: z.number().min(0).max(100),
  }),
  pricing: z.object({
    /** auto (market.csgo.com → Skinport) | marketcsgo | skinport | steam | mock | none (PRICE_PROVIDER env overrides). */
    provider: z.enum(['none', 'auto', 'marketcsgo', 'skinport', 'steam', 'mock']),
    /** Markup applied to the market price, percent (can be negative). */
    markupPercent: z.number().min(-90).max(500),
    minPrice: z.number().min(0.01),
  }),
  site: z.object({
    maintenance: z.boolean(),
    announcement: z.string().max(280),
    /** Show the (real) online counter in the live-drop rail. */
    showOnline: z.boolean().default(true),
  }),
}

export type SettingKey = keyof typeof settingSchemas
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>

export const settingDefaults: { [K in SettingKey]: SettingValue<K> } = {
  upgrade: { houseEdge: 0.08, minChance: 1, maxChance: 80, minMultiplier: 1.2, maxMultiplier: 100, quickMultipliers: [2, 5, 10], quickChances: [30, 50, 75], maxBalanceStake: 100000 },
  upgradeBonus: { enabled: true, minInterval: 6, maxInterval: 15, maxStake: 5000, zonePercent: 4, refundMinPercent: 30, refundMaxPercent: 50, doubleSharePercent: 50, doubleMaxMultiplier: 10 },
  inventory: { sellRatio: 0.95 },
  // Money is stored in coins (C). Deposits are charged in RUB, 1 C = 1 RUB.
  deposit: { minAmount: 100, maxAmount: 500000, presets: [300, 500, 1000, 2500, 5000, 10000], currency: 'RUB' },
  withdraw: { enabled: true, minAmount: 100, maxAmount: 500, methods: ['card', 'crypto_usdt'], perDay: 1 },
  skinWithdraw: { enabled: true, maxActive: 3 },
  cases: { rtp: 0.68, showOdds: false },
  drops: { wearWeights: { 'Factory New': 0.25, 'Minimal Wear': 22, 'Field-Tested': 42, 'Well-Worn': 6, 'Battle-Scarred': 29.75 } },
  referral: { inviteeBonusPercent: 5 },
  pricing: { provider: 'auto', markupPercent: 0, minPrice: 3 },
  site: { maintenance: false, announcement: '', showOnline: true },
}

const cache = new Map<string, { value: unknown; at: number }>()
const TTL_MS = 10_000

export async function getSetting<K extends SettingKey>(key: K, tx?: Executor): Promise<SettingValue<K>> {
  const hit = cache.get(key)
  if (!tx && hit && Date.now() - hit.at < TTL_MS) return hit.value as SettingValue<K>
  const [row] = await (tx ?? getDb()).select().from(settings).where(eq(settings.key, key))
  const parsed = settingSchemas[key].safeParse(row?.value)
  const value = (parsed.success ? parsed.data : settingDefaults[key]) as SettingValue<K>
  cache.set(key, { value, at: Date.now() })
  return value
}

export async function setSetting<K extends SettingKey>(tx: Executor, key: K, value: unknown, updatedBy: string | null) {
  const parsed = settingSchemas[key].parse(value)
  await tx
    .insert(settings)
    .values({ key, value: parsed, updatedBy })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed, updatedBy, updatedAt: new Date() } })
  cache.delete(key)
  return parsed
}

export async function getAllSettings() {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(settingSchemas) as SettingKey[]) out[key] = await getSetting(key)
  return out as { [K in SettingKey]: SettingValue<K> }
}

export function clearSettingsCache() {
  cache.clear()
}
