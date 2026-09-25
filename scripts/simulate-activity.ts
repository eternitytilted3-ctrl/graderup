import 'dotenv/config'
process.env.LOG_CONSOLE = 'false'
import { randomBytes } from 'node:crypto'
import { and, eq, like } from 'drizzle-orm'
import { hashPassword } from '../src/server/auth/password'
import { newReferralCode } from '../src/server/auth/providers/EmailAuthProvider'
import { closeDb, getDb } from '../src/server/db/client'
import { users } from '../src/server/db/schema'
import { adjustBalance } from '../src/server/services/admin'
import { listCases, openCases } from '../src/server/services/cases'
import { listInventory, sellItems } from '../src/server/services/inventory'
import { refreshSkinWithdrawals, requestSkinWithdrawal, setTradeUrl } from '../src/server/services/skinWithdrawals'
import { touchVisitor } from '../src/server/services/stats'
import { listUpgradeTargets, performUpgrade } from '../src/server/services/upgrade'

/**
 * TEST-ONLY activity simulator: bot accounts (bot_001…, emails bot…@sim.graderup.local) really open
 * cases, upgrade, sell and withdraw skins (through the dev mock trade provider) and keep a presence
 * heartbeat. The online counter, live drops and stats then reflect this activity in the TEST database —
 * nothing on the site is faked. Refuses to run with NODE_ENV=production.
 *
 *   npm run sim                         # 40 bots, a tick every 2 s, until Ctrl+C
 *   npm run sim -- --bots=80 --interval=1
 *   npm run sim -- --burst=2000         # quickly run 2000 actions, then keep ticking
 *   npm run sim -- --cleanup            # ban/park the bot accounts (they stop showing up online)
 */
if (process.env.NODE_ENV === 'production') {
  console.error('simulate-activity: refused — NODE_ENV=production. Bots are for local/test databases only.')
  process.exit(1)
}

const arg = (name: string, def: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def)
const BOTS = Math.max(1, Math.min(500, arg('bots', 40)))
const INTERVAL = Math.max(0.2, arg('interval', 2)) * 1000
const BURST = Math.max(0, arg('burst', 0))
const EMAIL_DOMAIN = 'sim.graderup.local'

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function ensureBots(adminId: string) {
  const db = getDb()
  const existing = await db.select().from(users).where(like(users.email, `%@${EMAIL_DOMAIN}`))
  const hash = await hashPassword(randomBytes(18).toString('base64url'))
  const bots = [...existing]
  for (let i = existing.length; i < BOTS; i++) {
    const n = String(i + 1).padStart(3, '0')
    const [u] = await db.insert(users).values({ username: `bot_${n}`, email: `bot${n}@${EMAIL_DOMAIN}`, passwordHash: hash, referralCode: newReferralCode() }).returning()
    await setTradeUrl(u.id, `https://steamcommunity.com/tradeoffer/new/?partner=${100000 + i}&token=simbot${n}`)
    bots.push(u)
  }
  for (const b of bots) if (b.isBanned) await db.update(users).set({ isBanned: false }).where(eq(users.id, b.id))
  // Top up bots that ran dry (admin adjustment → ledger).
  for (const b of bots.slice(0, BOTS)) {
    const [fresh] = await db.select({ balance: users.balance }).from(users).where(eq(users.id, b.id))
    if (Number(fresh.balance) < 500) await adjustBalance(adminId, b.id, (2000 + Math.floor(Math.random() * 20000)).toFixed(2), 'Симуляция активности (тест)')
  }
  return bots.slice(0, BOTS)
}

async function act(botId: string, casesList: { slug: string; price: string }[], adminId: string) {
  const r = Math.random()
  const [u] = await getDb().select({ balance: users.balance }).from(users).where(eq(users.id, botId))
  if (Number(u.balance) < 300) await adjustBalance(adminId, botId, (2000 + Math.floor(Math.random() * 15000)).toFixed(2), 'Симуляция активности (тест)')
  if (r < 0.55) {
    const affordable = casesList.filter((c) => Number(c.price) <= Number(u.balance) / 2)
    if (!affordable.length) return 'skip'
    const c = pick(affordable)
    await openCases(botId, c.slug, Math.random() < 0.8 ? 1 : 1 + Math.floor(Math.random() * 3))
    return 'open'
  }
  const inv = await listInventory(botId, { page: 1, pageSize: 50, sort: 'price_desc' })
  const avail = inv.items.filter((i) => i.status === 'available')
  if (!avail.length) return 'skip'
  if (r < 0.8) {
    const src = pick(avail)
    const mult = pick([1.5, 2, 2, 3, 5, 10])
    const t = await listUpgradeTargets({ minPrice: (Number(src.item.price) * mult).toFixed(2), page: 1, pageSize: 5, sort: 'price_asc' })
    if (!t.items[0]) return 'skip'
    await performUpgrade(botId, [src.id], t.items[0].id)
    return 'upgrade'
  }
  if (r < 0.93) {
    await sellItems(botId, avail.slice(0, 1 + Math.floor(Math.random() * 3)).map((i) => i.id))
    return 'sell'
  }
  await requestSkinWithdrawal(botId, pick(avail).id).catch(() => null)
  return 'withdraw'
}

async function main() {
  const db = getDb()
  const [admin] = await db.select().from(users).where(eq(users.role, 'superadmin')).limit(1)
  if (!admin) throw new Error('No superadmin found — run the seed first')

  if (process.argv.includes('--cleanup')) {
    await db.update(users).set({ isBanned: true }).where(and(like(users.email, `%@${EMAIL_DOMAIN}`)))
    console.log('✓ bot accounts parked (banned). Their past activity stays in the ledger/history of this test DB.')
    return
  }

  const bots = await ensureBots(admin.id)
  const casesList = (await listCases()).map((c) => ({ slug: c.slug, price: c.price }))
  console.log(`▶ simulating ${bots.length} bots (test DB only). Ctrl+C to stop.`)
  const stats: Record<string, number> = {}
  const tally = (k: string) => (stats[k] = (stats[k] ?? 0) + 1)

  for (let i = 0; i < BURST; i++) {
    tally(await act(pick(bots).id, casesList, admin.id).catch(() => 'error'))
    if (i % 200 === 199) console.log(`  burst ${i + 1}/${BURST}`, stats)
  }

  let stop = false
  process.on('SIGINT', () => (stop = true))
  let tick = 0
  while (!stop) {
    // Presence heartbeat: every bot counts as an online visitor while the simulator runs.
    await Promise.all(bots.map((b) => touchVisitor(`sim-${b.id.slice(0, 20)}`).catch(() => {})))
    const actors = bots.filter(() => Math.random() < 0.15)
    for (const b of actors) tally(await act(b.id, casesList, admin.id).catch(() => 'error'))
    if (tick % 10 === 0) await refreshSkinWithdrawals().catch(() => {})
    if (tick % 15 === 0) console.log(`  tick ${tick}`, stats)
    tick++
    await sleep(INTERVAL)
  }
  console.log('■ stopped', stats)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await sleep(300)
    await closeDb()
  })
