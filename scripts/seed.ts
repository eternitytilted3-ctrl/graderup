import 'dotenv/config'
process.env.LOG_CONSOLE = 'false'
import { count, eq } from 'drizzle-orm'
import { hashPassword } from '../src/server/auth/password'
import { newReferralCode } from '../src/server/auth/providers/EmailAuthProvider'
import { closeDb, getDb } from '../src/server/db/client'
import { caseItems, cases, items, promocodes, rewards, settings, users, type Rarity } from '../src/server/db/schema'
import { getMockProvider, mockAllowed } from '../src/server/payments'
import { adjustBalance } from '../src/server/services/admin'
import { openCase } from '../src/server/services/cases'
import { listInventory, sellItems } from '../src/server/services/inventory'
import { createPayment, handleWebhook } from '../src/server/services/payments'
import { claimReward } from '../src/server/services/rewards'
import { settingDefaults } from '../src/server/services/settings'
import { listUpgradeTargets, performUpgrade } from '../src/server/services/upgrade'

// Deterministic PRNG so the catalogue is identical on every seed.
let s = 20260924
const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
const between = (a: number, b: number) => a + (b - a) * rand()
const round2 = (n: number) => Math.round(n * 100) / 100

const RANGES: Record<Rarity, [number, number]> = {
  common: [0.05, 0.6],
  uncommon: [0.6, 3],
  rare: [3, 15],
  epic: [15, 60],
  legendary: [60, 400],
  mythic: [400, 2500],
}

const ARCHETYPES: { art: string; name: string; desc: string }[] = [
  { art: 'blade', name: 'Vector Blade', desc: 'Прямой клинок с балансом, смещённым к рукояти.' },
  { art: 'karambit', name: 'Hook Talon', desc: 'Изогнутый клинок с кольцом для хвата.' },
  { art: 'pistol', name: 'Pulse P9', desc: 'Компактный пистолет с облегчённым затвором.' },
  { art: 'rifle', name: 'Strata AR', desc: 'Штурмовая винтовка модульной конструкции.' },
  { art: 'sniper', name: 'Longwatch SR', desc: 'Снайперская винтовка с длинным стволом.' },
  { art: 'smg', name: 'Hornet SMG', desc: 'Пистолет-пулемёт для ближнего боя.' },
  { art: 'shotgun', name: 'Breaker 12', desc: 'Помповое ружьё с усиленным цевьём.' },
  { art: 'gloves', name: 'Grip Gloves', desc: 'Тактические перчатки с усиленными пальцами.' },
  { art: 'helmet', name: 'Visor Helm', desc: 'Шлем с панорамным визором.' },
  { art: 'grenade', name: 'Shock Charge', desc: 'Коллекционная граната-сувенир.' },
  { art: 'sticker', name: 'Crest Sticker', desc: 'Голографическая наклейка-герб.' },
  { art: 'gem', name: 'Core Shard', desc: 'Кристалл с внутренним свечением.' },
  { art: 'key', name: 'Vault Key', desc: 'Ключ от закрытого хранилища.' },
  { art: 'charm', name: 'Hex Charm', desc: 'Подвеска-брелок в форме шестигранника.' },
]

const FINISHES: Record<Rarity, string[]> = {
  common: ['Graphite', 'Sandstone', 'Field Grey', 'Ash', 'Concrete'],
  uncommon: ['Teal Lines', 'Moss', 'Carbon Weave', 'Rust Bloom', 'Signal'],
  rare: ['Azure Tide', 'Cyber Grid', 'Frostbite', 'Circuit', 'Nightfall'],
  epic: ['Violet Storm', 'Neon Pulse', 'Afterglow', 'Starlight', 'Eclipse'],
  legendary: ['Solar Flare', 'Gilded', 'Dragon Scale', 'Aurora'],
  mythic: ['Singularity', 'Prismatic', 'Void Heart'],
}

const CASES: { slug: string; name: string; price: number; description: string; featured?: boolean }[] = [
  { slug: 'starter', name: 'Starter', price: 0.49, description: 'Лёгкий старт: недорогие предметы и шанс на редкость.', featured: true },
  { slug: 'neon-rush', name: 'Neon Rush', price: 1.99, description: 'Яркие неоновые расцветки и быстрые апгрейды.', featured: true },
  { slug: 'emerald', name: 'Emerald', price: 2.99, description: 'Спокойная зелёная коллекция с сюрпризами.' },
  { slug: 'night-ops', name: 'Night Ops', price: 4.49, description: 'Тёмные тактические предметы для ночных операций.' },
  { slug: 'violet-core', name: 'Violet Core', price: 6.99, description: 'Фирменный фиолетовый кейс GraderUP.', featured: true },
  { slug: 'arctic', name: 'Arctic', price: 9.99, description: 'Ледяные расцветки и морозные эффекты.' },
  { slug: 'ember', name: 'Ember', price: 14.99, description: 'Огненная коллекция с высоким потенциалом.' },
  { slug: 'lunar', name: 'Lunar', price: 24.99, description: 'Лунная серия для терпеливых охотников.' },
  { slug: 'phantom', name: 'Phantom', price: 39.99, description: 'Призрачные предметы редких расцветок.', featured: true },
  { slug: 'prism', name: 'Prism', price: 59.99, description: 'Переливающиеся предметы всех оттенков.' },
  { slug: 'royal', name: 'Royal', price: 99.99, description: 'Золото и легендарные предметы.', featured: true },
  { slug: 'quantum', name: 'Quantum', price: 199.99, description: 'Максимальные ставки — мифические предметы.' },
]

/** Weights ∝ price^-k, with k chosen by binary search so that EV ≈ price × rtp. */
function weightsFor(prices: number[], casePrice: number, rtp: number) {
  const ev = (k: number) => {
    const w = prices.map((p) => Math.pow(p, -k))
    const sum = w.reduce((a, b) => a + b, 0)
    return prices.reduce((acc, p, i) => acc + (p * w[i]) / sum, 0)
  }
  let lo = 0
  let hi = 6
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (ev(mid) > casePrice * rtp) lo = mid
    else hi = mid
  }
  const w = prices.map((p) => Math.pow(p, -lo))
  const sum = w.reduce((a, b) => a + b, 0)
  return w.map((x) => Math.max(1, Math.round((x / sum) * 1_000_000)))
}

async function main() {
  const db = getDb()
  const [{ n }] = await db.select({ n: count() }).from(cases)
  if (n > 0) {
    console.log('Database already seeded — run `npm run db:reset` for a fresh seed.')
    await closeDb()
    return
  }

  // ── Settings ──
  for (const [key, value] of Object.entries(settingDefaults)) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing()
  }

  // ── Items ──
  const itemRows: (typeof items.$inferSelect)[] = []
  for (const rarity of Object.keys(RANGES) as Rarity[]) {
    const [lo, hi] = RANGES[rarity]
    const perRarity = { common: 14, uncommon: 13, rare: 12, epic: 11, legendary: 8, mythic: 6 }[rarity]
    for (let i = 0; i < perRarity; i++) {
      const a = ARCHETYPES[(i * 5 + rarity.length) % ARCHETYPES.length]
      const finish = FINISHES[rarity][i % FINISHES[rarity].length]
      const price = round2(Math.exp(between(Math.log(lo), Math.log(hi))))
      const [row] = await db
        .insert(items)
        .values({ name: `${a.name} | ${finish}`, image: `/assets/items/${a.art}.svg`, price: price.toFixed(2), rarity, description: a.desc })
        .onConflictDoNothing()
        .returning()
      if (row) itemRows.push(row)
    }
  }
  console.log(`✓ ${itemRows.length} items`)

  // ── Cases ──
  const sorted = [...itemRows].sort((a, b) => Number(a.price) - Number(b.price))
  for (const [idx, c] of CASES.entries()) {
    const pool = sorted.filter((i) => Number(i.price) >= c.price * 0.04 && Number(i.price) <= c.price * 40)
    // Spread ~12 items evenly across the pool's price range.
    const pick: typeof pool = []
    const want = Math.min(12, pool.length)
    for (let i = 0; i < want; i++) pick.push(pool[Math.round((i * (pool.length - 1)) / Math.max(1, want - 1))])
    const unique = [...new Map(pick.map((p) => [p.id, p])).values()]
    const weights = weightsFor(
      unique.map((u) => Number(u.price)),
      c.price,
      0.9,
    )
    const total = weights.reduce((a, b) => a + b, 0)
    const [row] = await db
      .insert(cases)
      .values({
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: `/assets/cases/${c.slug}.svg`,
        price: c.price.toFixed(2),
        sortOrder: idx,
        isFeatured: c.featured ?? false,
      })
      .returning()
    await db.insert(caseItems).values(
      unique.map((u, i) => ({ caseId: row.id, itemId: u.id, dropWeight: weights[i], dropChance: ((weights[i] / total) * 100).toFixed(5) })),
    )
  }
  console.log(`✓ ${CASES.length} cases`)

  // ── Rewards & promocodes ──
  await db.insert(rewards).values([
    { type: 'daily', title: 'Ежедневная награда', description: 'Заходите каждый день и забирайте бонус на баланс.', amount: '0.10', cooldownSeconds: 86400, minDepositTotal: '0' },
    { type: 'weekly', title: 'Еженедельная награда', description: 'Большой бонус раз в неделю для активных игроков.', amount: '1.00', cooldownSeconds: 604800, minDepositTotal: '10' },
    { type: 'referral', title: 'Реферальная награда', description: 'Бонус за каждого приглашённого друга, который пополнил баланс.', amount: '0.50', cooldownSeconds: 0, minDepositTotal: '0' },
  ])
  const giftItem = sorted.find((i) => i.rarity === 'rare')!
  await db.insert(promocodes).values([
    { code: 'WELCOME', type: 'fixed', value: '1.00', maxUses: 10000 },
    { code: 'BOOST10', type: 'percentage', value: '10.00', maxUses: 5000 },
    { code: 'GIFTDROP', type: 'item', value: '0', itemId: giftItem.id, maxUses: 500 },
    { code: 'SUMMER25', type: 'fixed', value: '2.00', maxUses: 100, expiresAt: new Date('2025-09-01T00:00:00Z') },
  ])
  console.log('✓ rewards & promocodes')

  // ── Users ──
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@graderup.local'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345!'
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'Demo12345!'
  const [admin] = await db
    .insert(users)
    .values({ username: 'admin', email: adminEmail, passwordHash: await hashPassword(adminPassword), role: 'superadmin', referralCode: newReferralCode() })
    .returning()
  const demoHash = await hashPassword(demoPassword)
  const demoNames = ['demo', 'lucky_fox', 'nightowl', 'pixel_hunter']
  const demo: (typeof users.$inferSelect)[] = []
  for (const [i, username] of demoNames.entries()) {
    const [u] = await db
      .insert(users)
      .values({
        username,
        email: `${username.replace('_', '')}@graderup.local`,
        passwordHash: demoHash,
        referralCode: newReferralCode(),
        createdAt: new Date(Date.now() - (30 - i * 5) * 86400_000),
      })
      .returning()
    demo.push(u)
  }
  // lucky_fox and nightowl were invited by demo.
  await db.update(users).set({ referredBy: demo[0].id }).where(eq(users.id, demo[1].id))
  await db.update(users).set({ referredBy: demo[0].id }).where(eq(users.id, demo[2].id))
  console.log(`✓ users: admin (${adminEmail}) + ${demo.length} demo`)

  // ── Demo activity through the real services (keeps the ledger consistent) ──
  const deposit = async (userId: string, amount: number) => {
    if (mockAllowed()) {
      const p = await createPayment(userId, amount)
      const mock = getMockProvider()
      const hook = mock.buildWebhook({ externalId: `mock_${p.id}`, paymentId: p.id, status: 'completed', amount: p.amount, currency: p.currency })
      await handleWebhook('mock', hook.body, new Headers({ 'x-mock-signature': hook.signature }))
    } else {
      await adjustBalance(admin.id, userId, amount.toFixed(2), 'Demo balance (seed)')
    }
  }
  const caseSlugs = ['starter', 'neon-rush', 'emerald', 'night-ops', 'violet-core']
  for (const [i, u] of demo.entries()) {
    await deposit(u.id, [150, 80, 60, 50][i])
    for (let k = 0; k < 10 + i * 2; k++) {
      const ok = await openCase(u.id, caseSlugs[(k + i) % caseSlugs.length]).then(() => true, () => false)
      if (!ok) break
    }
    const inv = await listInventory(u.id, { page: 1, pageSize: 50, sort: 'price_asc' })
    if (inv.items.length > 3) await sellItems(u.id, inv.items.slice(0, 3).map((x) => x.id))
    const rest = (await listInventory(u.id, { page: 1, pageSize: 50, sort: 'price_desc' })).items
    for (const src of rest.slice(0, 2)) {
      const targets = await listUpgradeTargets({ minPrice: (Number(src.item.price) * 2).toFixed(2), page: 1, pageSize: 5 })
      if (targets.items[0]) await performUpgrade(u.id, src.id, targets.items[0].id).catch(() => {})
    }
    await claimReward(u.id, 'daily').catch(() => {})
  }
  await claimReward(demo[0].id, 'referral').catch(() => {})
  await claimReward(demo[0].id, 'weekly').catch(() => {})
  console.log('✓ demo deposits, openings, sales, upgrades, rewards')

  console.log('\nLogin credentials:')
  console.log(`  admin: ${adminEmail} / ${adminPassword}`)
  console.log(`  demo:  demo@graderup.local / ${demoPassword}`)
  await new Promise((r) => setTimeout(r, 500)) // let fire-and-forget event logs flush
  await closeDb()
}

main().catch(async (err) => {
  console.error(err)
  await closeDb()
  process.exit(1)
})
