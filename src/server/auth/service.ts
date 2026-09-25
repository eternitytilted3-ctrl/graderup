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
  return { email: true, emailRegistration: env().EMAIL_REGISTRATION_ENABLED, steam: steamProvider().isEnabled() }
}

const RESERVED = /^(admin|administrator|root|support|moderator|mod|system|graderup|staff|help)$/i

/**
 * Display name from a Steam nickname: Unicode letters/digits (Cyrillic included), spaces and a few
 * symbols; control / zero-width / markup characters removed; 2..24 chars; staff-like names blocked.
 */
export function sanitizeNickname(raw: string | undefined | null) {
  const name = (raw ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/[^\p{L}\p{N} _.\-|!?*~^]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
    .trim()
  if (name.length < 2 || RESERVED.test(name.replace(/[\s_.-]/g, ''))) return null
  return name
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

/** Free username based on `base` (adds a short suffix when taken by someone else). */
async function uniqueUsername(tx: Tx | ReturnType<typeof getDb>, base: string, selfId?: string) {
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 24)}_${randomToken(4).replace(/[^a-zA-Z0-9]/g, '').slice(0, 4)}`
    const [taken] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = lower(${candidate})`)
    if (!taken || taken.id === selfId) return candidate
  }
  return `player_${randomToken(6).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`
}

/** Finds or creates the user linked to an external identity; keeps Steam nickname/avatar in sync. */
export async function loginWithExternalIdentity(identity: ExternalIdentity, referralCode?: string | null) {
  const db = getDb()
  const nick = sanitizeNickname(identity.username)
  const [linked] = await db
    .select({ user: users })
    .from(authAccounts)
    .innerJoin(users, eq(users.id, authAccounts.userId))
    .where(and(eq(authAccounts.provider, identity.provider), eq(authAccounts.providerUserId, identity.providerUserId)))
  if (linked) {
    if (linked.user.isBanned) throw Errors.banned()
    const patch: Partial<typeof users.$inferInsert> = { lastLoginAt: new Date(), updatedAt: new Date() }
    if (identity.avatarUrl) patch.avatarUrl = identity.avatarUrl
    // Steam-only accounts follow the current Steam nickname (email accounts keep their login name).
    if (nick && !linked.user.passwordHash && nick !== linked.user.username) patch.username = await uniqueUsername(db, nick, linked.user.id)
    await db.update(users).set(patch).where(eq(users.id, linked.user.id))
    if (identity.profile) await db.update(authAccounts).set({ profile: identity.profile }).where(and(eq(authAccounts.provider, identity.provider), eq(authAccounts.providerUserId, identity.providerUserId)))
    return { userId: linked.user.id, created: false }
  }
  return db.transaction(async (tx) => {
    const username = await uniqueUsername(tx, nick ?? `player_${identity.providerUserId.slice(-6)}`)
    let referredBy: string | null = null
    if (referralCode && /^[A-Z0-9]{3,16}$/i.test(referralCode)) {
      const [ref] = await tx.select({ id: users.id }).from(users).where(eq(users.referralCode, referralCode.toUpperCase()))
      referredBy = ref?.id ?? null
    }
    const [u] = await tx
      .insert(users)
      .values({ username, email: null, passwordHash: null, avatarUrl: identity.avatarUrl ?? null, referralCode: newReferralCode(), referredBy, lastLoginAt: new Date() })
      .returning({ id: users.id })
    await tx.insert(authAccounts).values({ userId: u.id, provider: identity.provider, providerUserId: identity.providerUserId, profile: identity.profile ?? null })
    return { userId: u.id, created: true }
  })
}
