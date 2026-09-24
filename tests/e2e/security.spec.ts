import { expect, test, type APIRequestContext } from '@playwright/test'

let ctx: APIRequestContext
let csrf = ''

test.describe.serial('API security', () => {
  test.beforeAll(async ({ playwright, baseURL }) => {
    // One login for the whole suite (login itself is rate limited per IP and per account).
    ctx = await playwright.request.newContext({ baseURL })
    const login = await ctx.post('/api/auth/login', { data: { login: 'nightowl', password: 'Demo12345!' }, headers: { origin: baseURL! } })
    expect(login.ok(), await login.text()).toBeTruthy()
    csrf = (await ctx.storageState()).cookies.find((c) => c.name === 'gu_csrf')!.value
  })
  test.afterAll(async () => ctx.dispose())

  test('protected endpoints require auth; admin API requires role', async ({ request }) => {
    for (const path of ['/api/inventory', '/api/profile', '/api/history', '/api/balance', '/api/rewards']) {
      const r = await request.get(path)
      expect(r.status(), path).toBe(401)
    }
    expect((await request.get('/api/admin/dashboard')).status()).toBe(401)
  })

  test('CSRF: mutations without Origin / token are rejected', async ({ baseURL }) => {
    // Cross-site origin
    const evil = await ctx.post('/api/rewards/daily/claim', { headers: { origin: 'https://evil.example' } })
    expect(evil.status()).toBe(403)
    // Same origin but missing double-submit token
    const noToken = await ctx.post('/api/rewards/daily/claim', { headers: { origin: baseURL! } })
    expect(noToken.status()).toBe(403)
    expect((await noToken.json()).error.code).toBe('CSRF')
    // Regular user cannot use admin API
    expect((await ctx.get('/api/admin/dashboard')).status()).toBe(403)
  })

  test('client-supplied price/userId/result are ignored; errors are sanitized', async ({ baseURL }) => {
    const h = { origin: baseURL!, 'x-csrf-token': csrf }
    const before = (await (await ctx.get('/api/balance')).json()).balance
    const open = await ctx.post('/api/cases/starter/open', { headers: h, data: { price: 0, userId: '00000000-0000-0000-0000-000000000000', itemId: 'x' } })
    expect(open.ok()).toBeTruthy()
    const after = (await open.json()).balance
    expect(Number(before) - Number(after)).toBeCloseTo(49, 2)

    // Upgrade with a fake chance/result is validated server-side
    const bad = await ctx.post('/api/upgrade', { headers: h, data: { userItemId: 'not-a-uuid', targetItemId: 'x', chance: 100, result: 'win' } })
    expect(bad.status()).toBe(422)
    const body = await bad.json()
    expect(JSON.stringify(body)).not.toMatch(/stack|node_modules|postgres|drizzle/i)

    // IDOR: foreign payment id → 404
    expect((await ctx.get('/api/payments/00000000-0000-4000-8000-000000000000')).status()).toBe(404)
  })

  test('idempotency key replays the same result instead of opening twice', async ({ baseURL }) => {
    const h = { origin: baseURL!, 'x-csrf-token': csrf, 'idempotency-key': `e2e-${Date.now()}-abcdef` }
    const a = await (await ctx.post('/api/cases/starter/open', { headers: h })).json()
    const r2 = await ctx.post('/api/cases/starter/open', { headers: h })
    expect(r2.headers()['idempotent-replayed']).toBe('true')
    expect((await r2.json()).openingId).toBe(a.openingId)
  })

  test('webhook with a forged signature is rejected', async ({ request }) => {
    const r = await request.post('/api/payments/webhook/mock', { data: { externalId: 'x', status: 'completed', amount: '1000.00', ts: Date.now() }, headers: { 'x-mock-signature': 'deadbeef' } })
    // 403 when the mock provider is active, 404 when it is disabled — never a credit.
    expect([403, 404]).toContain(r.status())
  })

  test('security headers are set', async ({ request }) => {
    const r = await request.get('/')
    expect(r.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(r.headers()['x-content-type-options']).toBe('nosniff')
    expect(r.headers()['x-powered-by']).toBeUndefined()
  })
})
