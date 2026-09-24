import { expect, test } from '@playwright/test'

async function emailLogin(page: import('@playwright/test').Page, login: string, password: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: /Вход по email/ }).click()
  await page.fill('input[name=login]', login)
  await page.fill('input[name=password]', password)
  await page.click('button[type=submit]')
}

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
    await emailLogin(page, 'pixel_hunter', 'Demo12345!')
    await expect(page.getByTestId('balance')).toBeVisible()
    const readBalance = async () => Number((await page.getByTestId('balance').innerText()).replace(/[^\d.]/g, ''))
    const start = await readBalance()

    // Deposit through the mock provider (credited by signed webhook).
    await page.goto('/deposit')
    await page.getByRole('button', { name: '500 C', exact: true }).click()
    await page.getByTestId('deposit-submit').click()
    await page.waitForURL(/\/deposit\/checkout\//)
    await page.getByTestId('mock-pay').click()
    await expect.poll(readBalance, { timeout: 20_000 }).toBe(start + 500)

    // Open a case (fast mode) and sell the drop from the result modal.
    await page.goto('/cases/starter')
    await page.getByLabel('Быстрое открытие').check()
    await page.getByTestId('open-case').click()
    await expect(page.getByTestId('drop-name')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /Продать/ }).click()
    await expect(page.getByText(/Продано за/)).toBeVisible()

    // Open two more for upgrade material.
    for (let i = 0; i < 2; i++) {
      await page.getByTestId('open-case').click()
      await expect(page.getByTestId('drop-name')).toBeVisible({ timeout: 15_000 })
      await page.getByRole('button', { name: /В инвентарь/ }).click()
    }

    await page.goto('/inventory')
    await expect(page.getByText(/\d+ предметов/)).toBeVisible()

    // Upgrade: pick first inventory item, quick "×2" picks a target server-side, dial spins.
    await page.goto('/upgrade')
    await page.locator('section[aria-label="Инвентарь для апгрейда"] button').first().click()
    await page.getByTestId('quick-x2').click()
    await expect(page.getByTestId('upgrade-chance')).toHaveText(/\d+\.\d{2}%/, { timeout: 10_000 })
    await page.getByTestId('upgrade-button').click()
    // The pointer must actually rotate while spinning.
    await page.waitForTimeout(800)
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

  test('wrong password is rejected with a clear message', async ({ page }) => {
    await emailLogin(page, 'pixel_hunter', 'wrong-password1')
    await expect(page.getByText('Неверный логин или пароль')).toBeVisible()
  })
})

test('admin: case editor warns on invalid probability, balance adjust is audited', async ({ page }) => {
  await emailLogin(page, 'admin@graderup.local', 'Admin12345!')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))

  await page.goto('/admin/cases')
  await page.getByText('Starter', { exact: true }).click()
  await expect(page.getByText('Total probability')).toBeVisible()
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
