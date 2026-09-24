import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getDb } from '@/server/db/client'
import { caseItems, cases, items, promocodes, rewards, userItems, users } from '@/server/db/schema'
import { applyBalanceChange } from '@/server/services/ledger'

export async function resetDb() {
  const db = getDb()
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;`)
  await migrate(db, { migrationsFolder: './src/server/db/migrations' })
}

let n = 0
export async function createUser(balance = '0') {
  const db = getDb()
  n++
  const [u] = await db
    .insert(users)
    .values({ username: `user${n}_${Date.now() % 100000}`, email: `u${n}_${Date.now()}@test.local`, passwordHash: 'x', referralCode: `R${n}${Date.now() % 100000}` })
    .returning()
  if (balance !== '0') await db.transaction((tx) => applyBalanceChange(tx, { userId: u.id, type: 'admin_adjustment', amount: balance }))
  return u
}

export async function createCatalog() {
  const db = getDb()
  const [cheap, mid, pricey] = await db
    .insert(items)
    .values([
      { name: 'Cheap', image: '/assets/items/pistol.svg', price: '1.00', rarity: 'common' },
      { name: 'Mid', image: '/assets/items/rifle.svg', price: '5.00', rarity: 'rare' },
      { name: 'Pricey', image: '/assets/items/blade.svg', price: '50.00', rarity: 'legendary' },
    ])
    .returning()
  const [c] = await db.insert(cases).values({ name: 'Test', slug: `test-${Date.now()}`, image: '/assets/cases/starter.svg', price: '2.00' }).returning()
  await db.insert(caseItems).values([
    { caseId: c.id, itemId: cheap.id, dropWeight: 80, dropChance: '80' },
    { caseId: c.id, itemId: mid.id, dropWeight: 19, dropChance: '19' },
    { caseId: c.id, itemId: pricey.id, dropWeight: 1, dropChance: '1' },
  ])
  const [daily] = await db.insert(rewards).values({ type: 'daily', title: 'Daily', amount: '0.10', cooldownSeconds: 86400 }).returning()
  const [promo] = await db.insert(promocodes).values({ code: 'TESTFIX', type: 'fixed', value: '1.00', maxUses: 3 }).returning()
  return { cheap, mid, pricey, case: c, daily, promo }
}

export async function balanceOf(userId: string) {
  const [r] = await getDb().execute<{ balance: string }>(sql`select balance from users where id = ${userId}`).then((r) => r.rows)
  return r.balance
}

export async function ledgerConsistent(userId: string) {
  const r = await getDb().execute<{ ok: boolean }>(sql`
    select (select balance from users where id = ${userId}) = coalesce((select sum(amount) from transactions where user_id = ${userId}), 0) as ok`)
  return r.rows[0].ok
}

/** Grants `n` copies of an item directly (deterministic test inventory). */
export async function grantItems(userId: string, itemId: string, n: number) {
  const rows = await getDb()
    .insert(userItems)
    .values(Array.from({ length: n }, () => ({ userId, itemId, source: 'admin' as const })))
    .returning({ id: userItems.id })
  return rows.map((r) => r.id)
}
