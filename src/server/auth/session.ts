import 'server-only'
import { and, eq, gt, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { env } from '@/config/env'
import { getDb } from '../db/client'
import { sessions, users } from '../db/schema'
import { randomToken, sha256 } from '../security/crypto'
import { COOKIES } from '@/lib/cookies'

export const SESSION_COOKIE = COOKIES.session
export const CSRF_COOKIE = COOKIES.csrf
export const CSRF_HEADER = 'x-csrf-token'

export type SessionUser = typeof users.$inferSelect
export interface AuthContext {
  sessionId: string
  csrfToken: string
  user: SessionUser
}

export interface CookieSpec {
  name: string
  value: string
  options: { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number }
}

function cookieSpecs(token: string, csrf: string, maxAge: number): CookieSpec[] {
  // Secure only over HTTPS: on plain-HTTP LAN / Radmin VPN access the browser would drop Secure cookies.
  const secure = env().APP_URL.startsWith('https://')
  return [
    { name: SESSION_COOKIE, value: token, options: { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge } },
    // Readable by JS on purpose: double-submit CSRF token echoed in the X-CSRF-Token header.
    { name: CSRF_COOKIE, value: csrf, options: { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge } },
  ]
}

export const clearSessionCookies = () => cookieSpecs('', '', 0)

export async function createSession(userId: string, meta: { ip: string; userAgent: string }) {
  const token = randomToken(32)
  const csrf = randomToken(24)
  const ttlDays = env().SESSION_TTL_DAYS
  const expiresAt = new Date(Date.now() + ttlDays * 86400_000)
  await getDb()
    .insert(sessions)
    .values({ userId, tokenHash: sha256(token), csrfToken: csrf, ip: meta.ip, userAgent: meta.userAgent, expiresAt })
  return { token, csrf, cookies: cookieSpecs(token, csrf, ttlDays * 86400) }
}

async function resolveToken(token: string | undefined): Promise<AuthContext | null> {
  if (!token || token.length > 128) return null
  const db = getDb()
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (row.user.isBanned) return null
  // Touch last_seen at most once a minute (used for "users online").
  if (Date.now() - row.session.lastSeenAt.getTime() > 60_000) {
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.session.id))
  }
  return { sessionId: row.session.id, csrfToken: row.session.csrfToken, user: row.user }
}

export function getAuthFromRequest(req: NextRequest) {
  return resolveToken(req.cookies.get(SESSION_COOKIE)?.value)
}

/** For Server Components / layouts. */
export async function getCurrentAuth(): Promise<AuthContext | null> {
  const store = await cookies()
  return resolveToken(store.get(SESSION_COOKIE)?.value)
}

export async function destroySession(sessionId: string) {
  await getDb().delete(sessions).where(eq(sessions.id, sessionId))
}

export async function destroyAllUserSessions(userId: string) {
  await getDb().delete(sessions).where(eq(sessions.userId, userId))
}
