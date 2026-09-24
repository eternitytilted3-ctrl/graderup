import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { users } from '../../db/schema'
import { AppError, Errors } from '../../http/errors'
import { randomToken } from '../../security/crypto'
import { hashPassword, verifyDummy, verifyPassword } from '../password'
import type { LoginInput, RegisterInput } from '../validation'
import type { CredentialsAuthProvider } from './AuthProvider'

const MAX_FAILED = 5
const LOCK_MINUTES = 15

export function newReferralCode() {
  return randomToken(9).replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase() || randomToken(6).toUpperCase()
}

export class EmailAuthProvider implements CredentialsAuthProvider<RegisterInput, LoginInput> {
  readonly id = 'email'
  readonly kind = 'credentials' as const
  isEnabled() {
    return true
  }

  async register(input: RegisterInput) {
    const db = getDb()
    const [dup] = await db
      .select({ username: users.username, email: users.email })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${input.username}) OR lower(${users.email}) = lower(${input.email})`)
      .limit(1)
    if (dup) {
      const field = dup.email?.toLowerCase() === input.email.toLowerCase() ? 'email' : 'username'
      throw Errors.validation({ fields: { [field]: field === 'email' ? 'Email уже зарегистрирован' : 'Имя пользователя занято' } })
    }
    let referredBy: string | null = null
    if (input.referralCode) {
      const [ref] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, input.referralCode.toUpperCase()))
      referredBy = ref?.id ?? null
    }
    const passwordHash = await hashPassword(input.password)
    try {
      const [u] = await db
        .insert(users)
        .values({ username: input.username, email: input.email, passwordHash, referralCode: newReferralCode(), referredBy })
        .returning({ id: users.id })
      return { userId: u.id }
    } catch (err) {
      // Unique violation from a concurrent registration.
      if ((err as { code?: string }).code === '23505' || (err as { cause?: { code?: string } }).cause?.code === '23505') {
        throw Errors.conflict('Пользователь с такими данными уже существует', 'USER_EXISTS')
      }
      throw err
    }
  }

  async authenticate(input: LoginInput) {
    const db = getDb()
    const login = input.login.trim()
    const [u] = await db
      .select()
      .from(users)
      .where(login.includes('@') ? sql`lower(${users.email}) = lower(${login})` : sql`lower(${users.username}) = lower(${login})`)
      .limit(1)
    const invalid = new AppError(401, 'INVALID_CREDENTIALS', 'Неверный логин или пароль')
    if (!u || !u.passwordHash) {
      await verifyDummy(input.password)
      throw invalid
    }
    if (u.lockedUntil && u.lockedUntil > new Date()) {
      throw new AppError(429, 'ACCOUNT_LOCKED', 'Слишком много неудачных попыток. Попробуйте через несколько минут.')
    }
    const ok = await verifyPassword(u.passwordHash, input.password)
    if (!ok) {
      const failed = u.failedLoginCount + 1
      await db
        .update(users)
        .set({
          failedLoginCount: failed >= MAX_FAILED ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : u.lockedUntil,
        })
        .where(eq(users.id, u.id))
      throw invalid
    }
    if (u.isBanned) throw Errors.banned()
    await db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, u.id))
    return { userId: u.id }
  }
}
