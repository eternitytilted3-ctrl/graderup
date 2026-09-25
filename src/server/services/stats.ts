import 'server-only'
import { count, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { caseOpenings, cases, items, presence, sessions, upgrades, users } from '../db/schema'
import { toItemDTO } from './mappers'
import { skinWithdrawStats } from './skinWithdrawals'

let publicCache: { at: number; data: Awaited<ReturnType<typeof loadPublicStats>> } | null = null

async function loadPublicStats() {
  const db = getDb()
  const [[u], [o], [up]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(caseOpenings),
    db.select({ n: count() }).from(upgrades),
  ])
  const skins = await skinWithdrawStats()
  return { users: u.n, casesOpened: o.n, upgrades: up.n, skinsWithdrawn: skins.count }
}

/** Cached for 30s: counters for the home page. */
export async function publicStats() {
  if (publicCache && Date.now() - publicCache.at < 30_000) return publicCache.data
  const data = await loadPublicStats()
  publicCache = { at: Date.now(), data }
  return data
}

export async function recentUpgradeWins(limit = 8) {
  const rows = await getDb()
    .select({ id: upgrades.id, chance: upgrades.chance, createdAt: upgrades.createdAt, item: items, username: users.username })
    .from(upgrades)
    .innerJoin(items, eq(items.id, upgrades.targetItemId))
    .innerJoin(users, eq(users.id, upgrades.userId))
    .where(eq(upgrades.result, 'win'))
    .orderBy(desc(upgrades.createdAt))
    .limit(limit)
  return rows.map((r) => ({ id: r.id, chance: r.chance, createdAt: r.createdAt.toISOString(), username: r.username, item: toItemDTO(r.item) }))
}

export async function popularCaseIds(limit = 8) {
  const rows = await getDb()
    .select({ id: cases.id, n: sql<number>`count(${caseOpenings.id})::int` })
    .from(cases)
    .leftJoin(caseOpenings, eq(caseOpenings.caseId, cases.id))
    .where(eq(cases.status, 'active'))
    .groupBy(cases.id)
    .orderBy(desc(sql`count(${caseOpenings.id})`))
    .limit(limit)
  return rows.map((r) => r.id)
}

const touched = new Map<string, number>()
let lastCleanup = 0
/** Marks a visitor (guest or user) as present. DB write at most once a minute per visitor. */
export async function touchVisitor(visitorId: string) {
  const now = Date.now()
  if ((touched.get(visitorId) ?? 0) > now - 60_000) return
  touched.set(visitorId, now)
  if (touched.size > 50_000) touched.clear()
  const db = getDb()
  await db.insert(presence).values({ visitorId }).onConflictDoUpdate({ target: presence.visitorId, set: { seenAt: sql`now()` } })
  if (now - lastCleanup > 10 * 60_000) {
    lastCleanup = now
    await db.delete(presence).where(sql`${presence.seenAt} < now() - interval '1 day'`)
  }
}

let visitorsCache: { at: number; n: number } | null = null
/** Real online: distinct visitors (guests included) seen in the last 5 minutes (cached 15s). */
export async function visitorsOnline() {
  if (visitorsCache && Date.now() - visitorsCache.at < 15_000) return visitorsCache.n
  const [r] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(presence)
    .where(sql`${presence.seenAt} > now() - interval '5 minutes'`)
  visitorsCache = { at: Date.now(), n: r?.n ?? 0 }
  return visitorsCache.n
}

let onlineCache: { at: number; n: number } | null = null
/** Distinct users with a session seen in the last 5 minutes (cached 15s). */
export async function usersOnline() {
  if (onlineCache && Date.now() - onlineCache.at < 15_000) return onlineCache.n
  const [r] = await getDb()
    .select({ n: sql<number>`count(distinct ${sessions.userId})::int` })
    .from(sessions)
    .where(sql`${sessions.lastSeenAt} > now() - interval '5 minutes'`)
  onlineCache = { at: Date.now(), n: r?.n ?? 0 }
  return onlineCache.n
}
