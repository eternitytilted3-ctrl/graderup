import { and, count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, getDb } from '@/server/db/client'
import { cases, payments, userItems } from '@/server/db/schema'
import { getMockProvider } from '@/server/payments'
import { listCases, openCase, openCases } from '@/server/services/cases'
import { listInventory, sellAllItems, sellItems } from '@/server/services/inventory'
import { requestSkinWithdrawal, setTradeUrl, cancelSkinWithdrawal } from '@/server/services/skinWithdrawals'
import { requestWithdrawal } from '@/server/services/withdrawals'
import { createPayment, handleWebhook } from '@/server/services/payments'
import { redeemPromocode } from '@/server/services/promocodes'
import { claimReward } from '@/server/services/rewards'
import { performUpgrade } from '@/server/services/upgrade'
import { balanceOf, createCatalog, createUser, grantItems, ledgerConsistent, resetDb } from './helpers'

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
  it('limited case past its end is hidden and cannot be opened (balance untouched)', async () => {
    const u = await createUser('10.00')
    await getDb().update(cases).set({ endsAt: new Date(Date.now() - 1000) }).where(eq(cases.id, cat.case.id))
    try {
      await expect(openCase(u.id, cat.case.id)).rejects.toThrow(/истекло/)
      expect((await listCases()).some((c) => c.id === cat.case.id)).toBe(false)
      expect(await balanceOf(u.id)).toBe('10.00')
    } finally {
      await getDb().update(cases).set({ endsAt: null }).where(eq(cases.id, cat.case.id))
    }
  })

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

describe('multi-open (×N)', () => {
  it('opens N cases atomically; not enough balance for all → nothing opened', async () => {
    const u = await createUser('6.00') // 3 cases worth
    await expect(openCases(u.id, cat.case.id, 5)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' })
    expect(await balanceOf(u.id)).toBe('6.00')
    const r = await openCases(u.id, cat.case.id, 3)
    expect(r.results).toHaveLength(3)
    expect(new Set(r.results.map((x) => x.userItemId)).size).toBe(3)
    expect(r.balance).toBe('0.00')
    expect(await ledgerConsistent(u.id)).toBe(true)
  })

  it('parallel ×5 opens never overspend', async () => {
    const u = await createUser('22.00') // 11 cases worth
    const rs = await settle(Array.from({ length: 6 }, () => openCases(u.id, cat.case.id, 5)))
    expect(ok(rs)).toBe(2)
    expect(await balanceOf(u.id)).toBe('2.00')
    expect(await ledgerConsistent(u.id)).toBe(true)
  })

  it('rejects count outside 1..5', async () => {
    const u = await createUser('100.00')
    await expect(openCases(u.id, cat.case.id, 6)).rejects.toMatchObject({ status: 400 })
    await expect(openCases(u.id, cat.case.id, 0)).rejects.toMatchObject({ status: 400 })
  })
})

describe('multi-source upgrade', () => {
  it('uses the sum of up to 5 items; all sources are consumed', async () => {
    const u = await createUser()
    const ids = await grantItems(u.id, cat.cheap.id, 5) // 5 × 1.00 = 5.00 → target 50.00 (×10)
    const r = await performUpgrade(u.id, ids, cat.pricey.id)
    expect(r.sourceValue).toBe('5.00')
    expect(r.sources).toHaveLength(5)
    const [{ n }] = await getDb().select({ n: count() }).from(userItems).where(and(eq(userItems.userId, u.id), eq(userItems.status, 'used')))
    expect(n).toBe(5)
    expect(await ledgerConsistent(u.id)).toBe(true)
  })

  it('rejects duplicates, >5 items and foreign items', async () => {
    const u = await createUser('12.00')
    const other = await createUser('2.00')
    const { results } = await openCases(u.id, cat.case.id, 5)
    const mine = results.map((r) => r.userItemId)
    const foreign = (await openCase(other.id, cat.case.id)).userItemId
    await expect(performUpgrade(u.id, [mine[0], mine[0]], cat.pricey.id)).rejects.toMatchObject({ status: 400 })
    await expect(performUpgrade(u.id, [...mine, foreign], cat.pricey.id)).rejects.toMatchObject({ status: 400 })
    await expect(performUpgrade(u.id, [mine[0], foreign], cat.pricey.id)).rejects.toMatchObject({ status: 404 })
  })

  it('overlapping parallel upgrades: each item is consumed at most once', async () => {
    const u = await createUser()
    const [a, b, c, d] = await grantItems(u.id, cat.cheap.id, 4)
    const rs = await settle([performUpgrade(u.id, [a, b], cat.pricey.id), performUpgrade(u.id, [b, c], cat.pricey.id), performUpgrade(u.id, [c, d], cat.pricey.id)])
    expect(ok(rs)).toBe(2) // {a,b} and {c,d} succeed, {b,c} conflicts
    expect(await ledgerConsistent(u.id)).toBe(true)
  })
})

describe('sell all / withdrawals', () => {
  it('sell-all sells every available item once (parallel calls)', async () => {
    const u = await createUser('10.00')
    await openCases(u.id, cat.case.id, 5)
    const rs = await settle([sellAllItems(u.id), sellAllItems(u.id), sellAllItems(u.id)])
    expect(ok(rs)).toBe(1)
    expect((await listInventory(u.id, { page: 1, pageSize: 10 })).total).toBe(0)
    expect(await ledgerConsistent(u.id)).toBe(true)
  })

  it('balance withdrawal: max amount and one request per day', async () => {
    const u = await createUser('2000.00')
    await expect(requestWithdrawal(u.id, { amount: 600, method: 'card', destination: '4111111111111111' })).rejects.toMatchObject({ status: 400 })
    const rs = await settle([1, 2, 3].map(() => requestWithdrawal(u.id, { amount: 500, method: 'card', destination: '4111111111111111' })))
    expect(ok(rs)).toBe(1)
    expect(await balanceOf(u.id)).toBe('1500.00')
  })

  it('skin withdrawal locks the item; double request fails; cancel returns it', async () => {
    const u = await createUser('2.00')
    const { userItemId } = await openCase(u.id, cat.case.id)
    await expect(requestSkinWithdrawal(u.id, userItemId)).rejects.toMatchObject({ status: 422 }) // no trade URL yet
    await setTradeUrl(u.id, 'https://steamcommunity.com/tradeoffer/new/?partner=123456&token=AbCdEf12')
    const rs = await settle([requestSkinWithdrawal(u.id, userItemId), requestSkinWithdrawal(u.id, userItemId)])
    expect(ok(rs)).toBe(1)
    await expect(sellItems(u.id, [userItemId])).rejects.toMatchObject({ code: 'ITEM_UNAVAILABLE' })
    const w = (rs.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ id: string }>).value
    const admin = await createUser()
    await cancelSkinWithdrawal(admin.id, w.id)
    expect((await sellItems(u.id, [userItemId])).soldCount).toBe(1)
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
    const rs = await settle(Array.from({ length: 10 }, () => performUpgrade(u.id, [userItemId], cat.pricey.id)))
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
    await expect(performUpgrade(u.id, [userItemId], cheaperOrSame)).rejects.toMatchObject({ status: 400 })
    await expect(performUpgrade(other.id, [userItemId], cat.pricey.id)).rejects.toMatchObject({ status: 404 })
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
    const p = await createPayment(u.id, 2500, 'mock')
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
