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
  }),
  referral: z.object({
    /** Bonus the invited user receives on first deposit, percent. */
    inviteeBonusPercent: z.number().min(0).max(100),
  }),
  pricing: z.object({
    /** none | skinport | steam | mock (PRICE_PROVIDER env overrides). */
    provider: z.enum(['none', 'skinport', 'steam', 'mock']),
    /** Markup applied to the market price, percent (can be negative). */
    markupPercent: z.number().min(-90).max(500),
    minPrice: z.number().min(0.01),
  }),
  site: z.object({
    maintenance: z.boolean(),
    announcement: z.string().max(280),
  }),
}

export type SettingKey = keyof typeof settingSchemas
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>

export const settingDefaults: { [K in SettingKey]: SettingValue<K> } = {
  upgrade: { houseEdge: 0.08, minChance: 1, maxChance: 80, minMultiplier: 1.2, maxMultiplier: 100 },
  inventory: { sellRatio: 0.95 },
  deposit: { minAmount: 1, maxAmount: 5000, presets: [5, 10, 25, 50, 100, 250], currency: 'USD' },
  withdraw: { enabled: true, minAmount: 10, maxAmount: 2000, methods: ['card', 'crypto_usdt'] },
  referral: { inviteeBonusPercent: 5 },
  pricing: { provider: 'none', markupPercent: 0, minPrice: 0.03 },
  site: { maintenance: false, announcement: '' },
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
