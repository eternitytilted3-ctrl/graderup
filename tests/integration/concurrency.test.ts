import { and, count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, getDb } from '@/server/db/client'
import { payments, userItems } from '@/server/db/schema'
import { getMockProvider } from '@/server/payments'
import { openCase } from '@/server/services/cases'
import { listInventory, sellItems } from '@/server/services/inventory'
import { createPayment, handleWebhook } from '@/server/services/payments'
import { redeemPromocode } from '@/server/services/promocodes'
import { claimReward } from '@/server/services/rewards'
import { performUpgrade } from '@/server/services/upgrade'
import { balanceOf, createCatalog, createUser, ledgerConsistent, resetDb } from './helpers'

let cat: Awaited<ReturnType<typeof createCatalog>>

beforeAll(async () => {
  await resetDb()
  cat = await createCatalog()
})
afterAll(async () => {
  await new Promise((r) => setTimeout(r, 200))
  await closeDb()
})

const settle = <T,>(ps: Promise<T>[]) => Promise.allSettled(ps)
const ok = (rs: PromiseSettledResult<unknown>[]) => rs.filter((r) => r.status === 'fulfilled').length

describe('case opening', () => {
  it('debits price from DB, grants item, keeps ledger consistent', async () => {
    const u = await createUser('10.00')
    const r = await openCase(u.id, cat.case.id)
    expect(r.reel[r.winIndex].id).toBe(r.item.id)
    expect(await balanceOf(u.id)).toBe('8.00')
    const inv = await listInventory(u.id, { page: 1, pageSize: 10 })
    expect(inv.total).toBe(1)
    expect(await ledgerConsistent(u.id)).toBe(true)
  })

  it('parallel opens cannot overspend (balance for exactly 3 cases)', async () => {
    const u = await createUser('6.00')
    const rs = await settle(Array.from({ length: 12 }, () => openCase(u.id, cat.case.slug)))
    expect(ok(rs)).toBe(3)
    expect(await balanceOf(u.id)).toBe('0.00')
    expect(await ledgerConsistent(u.id)).toBe(true)
  })

  it('rejects insufficient balance and disabled/unknown cases', async () => {
    const u = await createUser('1.00')
    await expect(openCase(u.id, cat.case.id)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' })
    await expect(openCase(u.id, 'does-not-exist')).rejects.toMatchObject({ status: 404 })
  })
})

describe('selling', () => {
  it('parallel sells of the same item succeed exactly once', async () => {
    const u = await createUser('2.00')
    const { userItemId } = await openCase(u.id, cat.case.id)
    const rs = await settle(Array.from({ length: 20 }, () => sellItems(u.id, [userItemId])))
    expect(ok(rs)).toBe(1)
    expect(await ledgerConsistent(u.id)).toBe(true)
  })

  it("cannot sell another user's item (IDOR)", async () => {
    const owner = await createUser('2.00')
    const thief = await createUser()
    const { userItemId } = await openCase(owner.id, cat.case.id)
    await expect(sellItems(thief.id, [userItemId])).rejects.toMatchObject({ code: 'ITEM_UNAVAILABLE' })
    expect(await balanceOf(thief.id)).toBe('0.00')
  })
})

describe('upgrade', () => {
  it('parallel upgrades of one item run exactly once', async () => {
    const u = await createUser('2.00')
    const { userItemId } = await openCase(u.id, cat.case.id)
    const rs = await settle(Array.from({ length: 10 }, () => performUpgrade(u.id, userItemId, cat.pricey.id)))
    expect(ok(rs)).toBe(1)
    const [{ n }] = await getDb().select({ n: count() }).from(userItems).where(and(eq(userItems.id, userItemId), eq(userItems.status, 'used')))
    expect(n).toBe(1)
    expect(await ledgerConsistent(u.id)).toBe(true)
  })

  it('rejects target cheaper than min multiplier and foreign items', async () => {
    const u = await createUser('2.00')
    const other = await createUser()
    const { userItemId, item } = await openCase(u.id, cat.case.id)
    const cheaperOrSame = item.id === cat.cheap.id ? cat.cheap.id : cat.cheap.id
    await expect(performUpgrade(u.id, userItemId, cheaperOrSame)).rejects.toMatchObject({ status: 400 })
    await expect(performUpgrade(other.id, userItemId, cat.pricey.id)).rejects.toMatchObject({ status: 404 })
  })
})

describe('rewards & promocodes', () => {
  it('daily reward can be claimed once under concurrency', async () => {
    const u = await createUser()
    const rs = await settle(Array.from({ length: 10 }, () => claimReward(u.id, 'daily')))
    expect(ok(rs)).toBe(1)
    expect(await balanceOf(u.id)).toBe('0.10')
  })

  it('promocode respects per-user uniqueness and max uses', async () => {
    const a = await createUser()
    const rs = await settle(Array.from({ length: 5 }, () => redeemPromocode(a.id, 'testfix')))
    expect(ok(rs)).toBe(1)
    const b = await createUser()
    const c = await createUser()
    const d = await createUser()
    const r2 = await settle([b, c, d].map((x) => redeemPromocode(x.id, 'TESTFIX')))
    expect(ok(r2)).toBe(2) // max_uses = 3
  })
})

describe('payments', () => {
  it('replayed webhook credits once; forged signature rejected', async () => {
    const u = await createUser()
    const p = await createPayment(u.id, 2500)
    const hook = getMockProvider().buildWebhook({ externalId: `mock_${p.id}`, paymentId: p.id, status: 'completed', amount: p.amount, currency: p.currency })
    const headers = new Headers({ 'x-mock-signature': hook.signature })
    await settle(Array.from({ length: 5 }, () => handleWebhook('mock', hook.body, headers)))
    expect(await balanceOf(u.id)).toBe('2500.00')
    await expect(handleWebhook('mock', hook.body.replace('2500.00', '250000.00'), headers)).rejects.toMatchObject({ status: 403 })
    const [row] = await getDb().select().from(payments).where(eq(payments.id, p.id))
    expect(row.status).toBe('completed')
    expect(await ledgerConsistent(u.id)).toBe(true)
  })
})
