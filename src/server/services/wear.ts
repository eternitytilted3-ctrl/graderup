import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { D } from '@/lib/money'
import type { Executor } from '../db/client'
import { items } from '../db/schema'
import { secureRandomInt } from '../security/crypto'
import type { SettingValue } from './settings'

type Item = typeof items.$inferSelect
export type WearWeights = SettingValue<'drops'>['wearWeights']

/** Loads all active wear variants for the given skins, grouped by base name. */
export async function loadFamilies(ex: Executor, reps: Item[]) {
  const names = [...new Set(reps.map((r) => r.baseName).filter((n): n is string => Boolean(n)))]
  const map = new Map<string, Item[]>()
  if (names.length) {
    const rows = await ex.select().from(items).where(and(inArray(items.baseName, names), eq(items.isActive, true)))
    for (const r of rows) {
      const list = map.get(r.baseName!) ?? []
      list.push(r)
      map.set(r.baseName!, list)
    }
  }
  return (rep: Item) => (rep.baseName && map.get(rep.baseName)?.length ? map.get(rep.baseName)! : [rep])
}

function weightOf(item: Item, weights: WearWeights) {
  if (!item.wear) return 1
  return weights[item.wear as keyof WearWeights] ?? 0
}

/** Server-side exterior roll among the variants that exist (weights renormalised). Integer RNG, 1e-4 resolution. */
export function rollWear(family: Item[], weights: WearWeights): { item: Item; roll: number; total: number } {
  const scaled = family.map((i) => Math.round(weightOf(i, weights) * 10_000))
  const total = scaled.reduce((a, b) => a + b, 0)
  if (total <= 0) return { item: family[0], roll: 0, total: 0 }
  const roll = secureRandomInt(total)
  let acc = 0
  for (let k = 0; k < family.length; k++) {
    acc += scaled[k]
    if (roll < acc) return { item: family[k], roll, total }
  }
  return { item: family[family.length - 1], roll, total }
}

/** Expected value of a skin after the exterior roll. */
export function familyExpectedPrice(family: Item[], weights: WearWeights) {
  const w = family.map((i) => weightOf(i, weights))
  const total = w.reduce((a, b) => a + b, 0)
  if (total <= 0) return D(family[0].price)
  return family.reduce((s, i, k) => s.plus(D(i.price).mul(w[k])), D(0)).div(total)
}
