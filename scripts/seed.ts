import 'dotenv/config'
process.env.LOG_CONSOLE = 'false'
import { asc, count, eq } from 'drizzle-orm'
import { hashPassword } from '../src/server/auth/password'
import { newReferralCode } from '../src/server/auth/providers/EmailAuthProvider'
import { closeDb, getDb } from '../src/server/db/client'
import { buildCases } from '../src/server/catalog/cases'
import { importCs2Catalog } from '../src/server/catalog/cs2'
import { cases, items, promocodes, rewards, settings, users, type Rarity } from '../src/server/db/schema'
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
  common: [4, 50],
  uncommon: [50, 250],
  rare: [250, 1200],
  epic: [1200, 5000],
  legendary: [5000, 35000],
  mythic: [35000, 200000],
}

// Generic weapon designations + ORIGINAL finish names (no third-party skin names/art).
const POOLS: Record<Rarity, { art: string; name: string }[]> = {
  common: [
    { art: 'sticker', name: 'Sticker' },
    { art: 'charm', name: 'Charm' },
    { art: 'pistol', name: 'Glock-18' },
    { art: 'pistol', name: 'P250' },
    { art: 'smg', name: 'MP9' },
    { art: 'shotgun', name: 'Nova' },
    { art: 'grenade', name: 'Charm' },
  ],
  uncommon: [
    { art: 'pistol', name: 'USP-S' },
    { art: 'smg', name: 'MAC-10' },
    { art: 'smg', name: 'UMP-45' },
    { art: 'rifle', name: 'Galil AR' },
    { art: 'shotgun', name: 'XM1014' },
    { art: 'sticker', name: 'Sticker' },
  ],
  rare: [
    { art: 'rifle', name: 'FAMAS' },
    { art: 'smg', name: 'P90' },
    { art: 'sniper', name: 'SSG 08' },
    { art: 'pistol', name: 'Five-SeveN' },
    { art: 'rifle', name: 'AUG' },
  ],
  epic: [
    { art: 'rifle', name: 'M4A1-S' },
    { art: 'rifle', name: 'M4A4' },
    { art: 'pistol', name: 'Desert Eagle' },
    { art: 'sniper', name: 'AWP' },
    { art: 'rifle', name: 'AK-47' },
  ],
  legendary: [
    { art: 'rifle', name: 'AK-47' },
    { art: 'sniper', name: 'AWP' },
    { art: 'gloves', name: '★ Sport Gloves' },
    { art: 'blade', name: '★ Bayonet' },
  ],
  mythic: [
    { art: 'karambit', name: '★ Karambit' },
    { art: 'blade', name: '★ Butterfly Knife' },
    { art: 'gloves', name: '★ Driver Gloves' },
  ],
}

const WEARS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred']

const DESCRIPTIONS: Record<string, string> = {
  sticker: 'Голографическая наклейка из коллекции GraderUP.',
  charm: 'Брелок-подвеска для оружия.',
  grenade: 'Брелок в форме гранаты.',
  pistol: 'Пистолет с оригинальной раскраской.',
  smg: 'Пистолет-пулемёт для ближнего боя.',
  shotgun: 'Дробовик с усиленной отделкой.',
  rifle: 'Винтовка с оригинальной раскраской.',
  sniper: 'Снайперская винтовка с оригинальной раскраской.',
  gloves: 'Перчатки с кастомной отделкой.',
  blade: 'Нож редкой отделки.',
  karambit: 'Изогнутый нож — одна из самых редких находок.',
}

const FINISHES: Record<Rarity, string[]> = {
  common: ['Graphite', 'Sandstone', 'Field Grey', 'Ash', 'Concrete'],
  uncommon: ['Teal Lines', 'Moss', 'Carbon Weave', 'Rust Bloom', 'Signal'],
  rare: ['Azure Tide', 'Cyber Grid', 'Frostbite', 'Circuit', 'Nightfall'],
  epic: ['Violet Storm', 'Neon Pulse', 'Afterglow', 'Starlight', 'Eclipse'],
  legendary: ['Solar Flare', 'Gilded', 'Dragon Scale', 'Aurora'],
  mythic: ['Singularity', 'Prismatic', 'Void Heart'],
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

  // ── Items: real CS2 skins (ByMykel catalogue + Skinport RUB prices), or offline fallback ──
  let realSkins = false
  if (process.env.SEED_REAL_SKINS !== 'false') {
    try {
      await importCs2Catalog({ log: (m) => console.log(`  · ${m}`) })
      realSkins = true
    } catch (err) {
      console.log(`  · CS2 catalogue unavailable (${(err as Error).message}) — using generated demo items`)
    }
  }
  if (!realSkins) {
    const usedNames = new Set<string>()
    for (const rarity of Object.keys(RANGES) as Rarity[]) {
      const [lo, hi] = RANGES[rarity]
      const perRarity = { common: 14, uncommon: 13, rare: 12, epic: 11, legendary: 8, mythic: 6 }[rarity]
      for (let i = 0; i < perRarity; i++) {
        const a = POOLS[rarity][i % POOLS[rarity].length]
        const finish = FINISHES[rarity][i % FINISHES[rarity].length]
        const isWeapon = !['sticker', 'charm', 'grenade'].includes(a.art)
        let wear = isWeapon ? ` (${WEARS[(i + rarity.length) % WEARS.length]})` : ''
        for (let w = 1; usedNames.has(`${a.name} | ${finish}${wear}`) && w <= WEARS.length; w++) wear = ` (${WEARS[(i + rarity.length + w) % WEARS.length]})`
        if (usedNames.has(`${a.name} | ${finish}${wear}`)) continue
        usedNames.add(`${a.name} | ${finish}${wear}`)
        const price = round2(Math.exp(between(Math.log(lo), Math.log(hi))))
        await db.insert(items).values({ name: `${a.name} | ${finish}${wear}`, image: `/assets/items/${a.art}.svg`, price: price.toFixed(2), rarity, description: DESCRIPTIONS[a.art] ?? '' })
      }
    }
  }
  const [{ n: itemCount }] = await db.select({ n: count() }).from(items)
  console.log(`✓ ${itemCount} items${realSkins ? ' (CS2)' : ''}`)

  // ── Cases ──
  const built = await buildCases()
  console.log(`✓ ${built.cases} cases`)

  // ── Rewards & promocodes ──
  await db.insert(rewards).values([
    { type: 'daily', title: 'Ежедневная награда', description: 'Заходите каждый день и забирайте бонус на баланс.', amount: '10', cooldownSeconds: 86400, minDepositTotal: '0' },
    { type: 'weekly', title: 'Еженедельная награда', description: 'Большой бонус раз в неделю для активных игроков.', amount: '100', cooldownSeconds: 604800, minDepositTotal: '1000' },
    { type: 'referral', title: 'Реферальная награда', description: 'Бонус за каждого приглашённого друга, который пополнил баланс.', amount: '50', cooldownSeconds: 0, minDepositTotal: '0' },
  ])
  const [giftItem] = await db.select().from(items).where(eq(items.rarity, 'rare')).orderBy(asc(items.price)).limit(1)
  await db.insert(promocodes).values([
    { code: 'WELCOME', type: 'fixed', value: '100', maxUses: 10000 },
    { code: 'BOOST10', type: 'percentage', value: '10.00', maxUses: 5000 },
    { code: 'GIFTDROP', type: 'item', value: '0', itemId: giftItem.id, maxUses: 500 },
    { code: 'SUMMER25', type: 'fixed', value: '200', maxUses: 100, expiresAt: new Date('2025-09-01T00:00:00Z') },
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
      const p = await createPayment(userId, amount, 'mock')
      const mock = getMockProvider()
      const hook = mock.buildWebhook({ externalId: `mock_${p.id}`, paymentId: p.id, status: 'completed', amount: p.amount, currency: p.currency })
      await handleWebhook('mock', hook.body, new Headers({ 'x-mock-signature': hook.signature }))
    } else {
      await adjustBalance(admin.id, userId, amount.toFixed(2), 'Demo balance (seed)')
    }
  }
  const caseSlugs = ['magnum', 'exposure', 'neo', 'steel', 'fog', 'green']
  for (const [i, u] of demo.entries()) {
    await deposit(u.id, [15000, 8000, 6000, 5000][i])
    for (let k = 0; k < 10 + i * 2; k++) {
      const ok = await openCase(u.id, caseSlugs[(k + i) % caseSlugs.length]).then(() => true, () => false)
      if (!ok) break
    }
    const inv = await listInventory(u.id, { page: 1, pageSize: 50, sort: 'price_asc' })
    if (inv.items.length > 3) await sellItems(u.id, inv.items.slice(0, 3).map((x) => x.id))
    const rest = (await listInventory(u.id, { page: 1, pageSize: 50, sort: 'price_desc' })).items
    for (const src of rest.slice(0, 2)) {
      const targets = await listUpgradeTargets({ minPrice: (Number(src.item.price) * 2).toFixed(2), page: 1, pageSize: 5 })
      if (targets.items[0]) await performUpgrade(u.id, [src.id], targets.items[0].id).catch(() => {})
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
