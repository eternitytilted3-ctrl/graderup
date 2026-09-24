import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { env } from '@/config/env'
import { getDb } from '../db/client'
import { authAccounts, users } from '../db/schema'
import { Errors } from '../http/errors'
import { randomToken } from '../security/crypto'
import type { ExternalIdentity } from './providers/AuthProvider'
import { EmailAuthProvider, newReferralCode } from './providers/EmailAuthProvider'
import { SteamAuthProvider } from './providers/SteamAuthProvider'

export const emailProvider = new EmailAuthProvider()

export function steamProvider() {
  const cfg = env()
  return new SteamAuthProvider({ enabled: cfg.STEAM_AUTH_ENABLED, appUrl: cfg.APP_URL, apiKey: cfg.STEAM_API_KEY })
}

export function enabledProviders() {
  return { email: true, steam: steamProvider().isEnabled() }
}

/** Finds or creates the user linked to an external identity. */
export async function loginWithExternalIdentity(identity: ExternalIdentity) {
  const db = getDb()
  const [linked] = await db
    .select({ user: users })
    .from(authAccounts)
    .innerJoin(users, eq(users.id, authAccounts.userId))
    .where(and(eq(authAccounts.provider, identity.provider), eq(authAccounts.providerUserId, identity.providerUserId)))
  if (linked) {
    if (linked.user.isBanned) throw Errors.banned()
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, linked.user.id))
    return { userId: linked.user.id, created: false }
  }
  return db.transaction(async (tx) => {
    const base = (identity.username ?? identity.provider).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || identity.provider
    let username = base.length >= 3 ? base : `${base}_user`
    const [taken] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = lower(${username})`)
    if (taken) username = `${username.slice(0, 16)}_${randomToken(4).replace(/[^a-zA-Z0-9]/g, '').slice(0, 5)}`
    const [u] = await tx
      .insert(users)
      .values({ username, email: null, passwordHash: null, avatarUrl: identity.avatarUrl ?? null, referralCode: newReferralCode(), lastLoginAt: new Date() })
      .returning({ id: users.id })
    await tx.insert(authAccounts).values({ userId: u.id, provider: identity.provider, providerUserId: identity.providerUserId, profile: identity.profile ?? null })
    return { userId: u.id, created: true }
  })
}
