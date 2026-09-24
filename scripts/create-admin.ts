import 'dotenv/config'
import { eq, sql } from 'drizzle-orm'
import { hashPassword } from '../src/server/auth/password'
import { newReferralCode } from '../src/server/auth/providers/EmailAuthProvider'
import { emailSchema, passwordSchema, usernameSchema } from '../src/server/auth/validation'
import { closeDb, getDb } from '../src/server/db/client'
import { adminLogs, users } from '../src/server/db/schema'

/**
 * Creates a superadmin or promotes an existing user.
 * Usage: npm run admin:create -- --email you@example.com --username boss --password 'S3cure-pass'
 *        npm run admin:create -- --promote existing_username
 */
function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const db = getDb()
  const promote = arg('promote')
  if (promote) {
    const [u] = await db.update(users).set({ role: 'superadmin' }).where(sql`lower(${users.username}) = lower(${promote})`).returning()
    if (!u) throw new Error(`User ${promote} not found`)
    await db.insert(adminLogs).values({ adminId: null, action: 'cli_promote_superadmin', targetType: 'user', targetId: u.id })
    console.log(`✓ ${u.username} is now superadmin`)
    return
  }
  const email = emailSchema.parse(arg('email'))
  const username = usernameSchema.parse(arg('username'))
  const password = passwordSchema.parse(arg('password'))
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (exists) throw new Error('User with this email already exists; use --promote <username>')
  const [u] = await db
    .insert(users)
    .values({ username, email, passwordHash: await hashPassword(password), role: 'superadmin', referralCode: newReferralCode() })
    .returning()
  await db.insert(adminLogs).values({ adminId: null, action: 'cli_create_superadmin', targetType: 'user', targetId: u.id })
  console.log(`✓ superadmin ${u.username} created`)
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => closeDb())
