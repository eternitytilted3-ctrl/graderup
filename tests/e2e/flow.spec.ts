import { expect, test } from '@playwright/test'

type Page = import('@playwright/test').Page

/** Demo players have email passwords (seed only); the public UI signs in via Steam, so tests use the API. */
async function apiLogin(page: Page, login: string, password: string) {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
  const r = await page.request.post('/api/auth/login', { data: { login, password }, headers: { origin: base } })
  expect(r.ok(), await r.text()).toBeTruthy()
  await page.goto('/')
}

async function staffLogin(page: Page, login: string, password: string) {
  await page.goto('/cmsadmin')
  await page.fill('input[name=login]', login)
  await page.fill('input[name=password]', password)
  await page.click('button[type=submit]')
}

test('cases catalogue: category sections, price chips, no sort dropdown', async ({ page }) => {
  await page.goto('/cases')
  for (const name of ['Бюджетные', 'Классика', 'Ножевые кейсы', 'Премиум и Limited']) await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByLabel('Сортировка')).toHaveCount(0)
  await page.getByRole('radio', { name: 'До 50 C' }).click()
  await expect(page.getByText('Магнум', { exact: true })).toBeVisible()
  await expect(page.getByText('Премиум', { exact: true })).toHaveCount(0)
})

test('auth page: Steam is the primary sign-in, public email sign-up is disabled', async ({ page, request }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Авторизация/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Авторизация' })).toBeVisible()
  await expect(page.getByTestId('steam-login')).toBeVisible()
  await page.goto('/register')
  await expect(page).toHaveURL(/\/login/)
  // Server builds a Steam OpenID 2.0 request with our realm/return URL.
  const r = await request.get('/api/auth/steam?ref=ABC123', { maxRedirects: 0 })
  expect(r.status()).toBe(307)
  const loc = new URL(r.headers()['location'])
  expect(loc.origin).toBe('https://steamcommunity.com')
  expect(loc.searchParams.get('openid.mode')).toBe('checkid_setup')
  expect(loc.searchParams.get('openid.return_to')).toContain('/api/auth/steam/callback?state=')
  // A forged callback without valid state is rejected.
  const cb = await request.get('/api/auth/steam/callback?state=x&openid.mode=id_res&openid.claimed_id=https://steamcommunity.com/openid/id/76561197960287930', { maxRedirects: 0 })
  expect(cb.headers()['location']).toContain('/login?error=steam')
  const reg = await request.post('/api/auth/register', { headers: { origin: new URL(page.url()).origin }, data: { username: 'x_user', email: 'x@test.local', password: 'Abcdef123', acceptTerms: true, confirmAge: true } })
  expect(reg.status()).toBe(503)
})

test.describe.serial('user journey', () => {
  test('login → deposit → open case → sell → upgrade → rewards → history → logout', async ({ page }) => {
    await apiLogin(page, 'pixel_hunter', 'Demo12345!')
    await expect(page.getByTestId('balance')).toBeVisible()
    const readBalance = async () => Number((await page.getByTestId('balance').innerText()).replace(/[^\d.]/g, ''))
    const start = await readBalance()

    // Deposit through the mock provider (credited by signed webhook).
    await page.goto('/deposit')
    await page.getByRole('button', { name: '500 C', exact: true }).click()
    await page.getByTestId('deposit-submit').click()
    await page.waitForURL(/\/deposit\/checkout\//)
    await page.getByTestId('mock-pay').click()
    await expect.poll(async () => Math.round((await readBalance()) * 100), { timeout: 20_000 }).toBe(Math.round((start + 500) * 100))

    // Open a case (fast mode) and sell the drop from the result modal.
    await page.goto('/cases/magnum')
    await page.getByLabel('Быстрое открытие').check()
    await page.getByTestId('open-case').click()
    await expect(page.getByTestId('drop-name')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('sell-all').click()
    await expect(page.getByText(/Продано за/)).toBeVisible()

    // Open ×3 at once: three reels, three drops, keep them for the upgrade.
    await page.getByTestId('count-3').click()
    await expect(page.getByTestId('open-case')).toContainText('3 кейса')
    await page.getByTestId('open-case').click()
    await expect(page.getByTestId('drop-name')).toHaveCount(3, { timeout: 15_000 })
    await page.getByRole('button', { name: /В инвентарь/ }).click()

    await page.goto('/inventory')
    await expect(page.getByText(/\d+ предметов/)).toBeVisible()

    // Withdraw one skin to Steam (mock trade provider in dev): searching → accept → withdrawn.
    await page.getByTestId('withdraw-skin').first().click()
    await page.getByTestId('trade-url').fill('https://steamcommunity.com/tradeoffer/new/?partner=123456&token=AbCdEf12')
    await page.getByTestId('confirm-skin-withdraw').click()
    await expect(page.getByText(/Вывод создан/)).toBeVisible()
    await page.goto('/withdraw?tab=skins')
    await expect(page.getByTestId('skin-withdrawals').getByText('Ищем продавца').first()).toBeVisible()

    // Upgrade: pick first inventory item, quick "×2" picks a target server-side, dial spins.
    await page.goto('/upgrade')
    const invCards = page.locator('section[aria-label="Инвентарь для апгрейда"] button[aria-pressed]')
    await invCards.nth(0).click()
    await invCards.nth(1).click()
    await expect(page.getByText(/Ваши предметы · 2\/5/)).toBeVisible()
    await page.getByTestId('upgrade-fast').check()
    await page.getByTestId('quick-x2').click()
    await expect(page.getByTestId('upgrade-chance')).toHaveText(/\d+\.\d{2}%/, { timeout: 10_000 })
    await page.getByTestId('upgrade-button').click()
    // The pointer must actually rotate while spinning.
    await page.waitForTimeout(300)
    const rotating = await page.evaluate(() => document.getAnimations().some((a) => a.playState === 'running'))
    expect(rotating).toBe(true)
    await expect(page.getByText(/Апгрейд (успешен|не удался)/)).toBeVisible({ timeout: 15_000 })

    // Daily reward: claimed once per UTC day (seed may have claimed it already).
    await page.goto('/rewards')
    const claim = page.getByTestId('reward-daily').getByRole('button', { name: 'Забрать' })
    if (await claim.isVisible()) await claim.click()
    await expect(page.getByTestId('reward-daily').getByText('Получено')).toBeVisible()

    await page.goto('/history')
    await expect(page.getByText('Пополнение').first()).toBeVisible()
    await expect(page.getByText('Открытие кейса').first()).toBeVisible()
    await expect(page.getByText('Апгрейд').first()).toBeVisible()

    // Logout
    await page.getByRole('button', { name: /pixel_hunter/ }).first().click()
    await page.getByRole('menuitem', { name: 'Выйти' }).click()
    await expect(page.getByRole('link', { name: /Авторизация/ }).first()).toBeVisible()
    await page.goto('/inventory')
    await expect(page).toHaveURL(/\/login\?next=%2Finventory/)
  })

  test('staff login: non-admin accounts and wrong passwords are rejected', async ({ page }) => {
    await staffLogin(page, 'pixel_hunter', 'Demo12345!')
    await expect(page.getByText('Неверный логин или пароль')).toBeVisible()
    await staffLogin(page, 'admin@graderup.local', 'wrong-password1')
    await expect(page.getByText('Неверный логин или пароль')).toBeVisible()
  })

  test('sell all inventory', async ({ page }) => {
    await apiLogin(page, 'nightowl', 'Demo12345!')
    await page.goto('/inventory')
    await page.getByTestId('sell-all-inventory').click()
    await page.getByRole('button', { name: /Продать всё ≈/ }).click()
    await expect(page.getByText(/Продано предметов/)).toBeVisible()
    await expect(page.getByText('Инвентарь пуст')).toBeVisible()
  })
})

test('admin: case editor warns on invalid probability, balance adjust is audited', async ({ page }) => {
  await staffLogin(page, 'admin@graderup.local', 'Admin12345!')
  await page.waitForURL(/\/admin/)

  await page.goto('/admin/cases')
  await page.getByText('Магнум', { exact: true }).click()
  await expect(page.getByText('Total probability')).toBeVisible()
  // Custom case image upload: real PNG accepted, SVG rejected by magic-byte check.
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)])
  await page.getByTestId('image-upload').setInputFiles({ name: 'crate.png', mimeType: 'image/png', buffer: png })
  await expect(page.locator('input[name=image]')).toHaveValue(/^\/api\/uploads\/[a-f0-9]{32}\.png$/)
  const uploaded = await page.locator('input[name=image]').inputValue()
  expect((await page.request.get(uploaded)).headers()['content-type']).toBe('image/png')
  await page.getByTestId('image-upload').setInputFiles({ name: 'evil.png', mimeType: 'image/png', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') })
  await expect(page.getByText(/Допустимы только PNG, JPEG или WebP/)).toBeVisible()
  const first = page.locator('input[aria-label^="Шанс"]').first()
  await first.fill('99')
  await expect(page.getByText(/Сумма вероятностей .* ≠ 100%/)).toBeVisible()

  await page.goto('/admin/users')
  await page.getByText('lucky_fox').click()
  await page.fill('input[name=amount]', '3.50')
  await page.fill('input[name=reason]', 'E2E compensation')
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(page.getByText('Баланс изменён')).toBeVisible()
  await page.goto('/admin/logs')
  await page.getByRole('tab', { name: 'Действия администраторов' }).click()
  await expect(page.getByText('balance_adjust').first()).toBeVisible()
})
