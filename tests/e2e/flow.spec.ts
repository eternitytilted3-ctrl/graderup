import { expect, test } from '@playwright/test'

const uname = `e2e_${Date.now().toString(36)}`
const password = 'E2eTest12345'

test.describe.serial('user journey', () => {
  test('register → deposit → open case → sell → upgrade → rewards → history → logout', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[name=username]', uname)
    await page.fill('input[name=email]', `${uname}@test.local`)
    await page.fill('input[name=password]', password)
    await page.check('input[name=confirmAge]')
    await page.check('input[name=acceptTerms]')
    await page.click('button[type=submit]')
    await expect(page.getByTestId('balance')).toHaveText('$0.00')

    // Deposit through the mock provider (credited by signed webhook).
    await page.goto('/deposit')
    await page.getByRole('button', { name: '$50', exact: true }).click()
    await page.getByTestId('deposit-submit').click()
    await page.waitForURL(/\/deposit\/checkout\//)
    await page.getByTestId('mock-pay').click()
    await expect(page.getByTestId('balance')).toHaveText('$50.00', { timeout: 20_000 })

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
    await expect(page.getByText(/2 предметов/)).toBeVisible()

    // Upgrade: pick first inventory item and first target, server returns the chance.
    await page.goto('/upgrade')
    await page.locator('section[aria-label="Инвентарь для апгрейда"] button').first().click()
    await page.locator('section[aria-label="Целевые предметы"] button[aria-pressed]').first().click()
    await expect(page.getByTestId('upgrade-chance')).toHaveText(/\d+\.\d{2}%/, { timeout: 10_000 })
    await page.getByTestId('upgrade-button').click()
    await expect(page.getByText(/Апгрейд (успешен|не удался)/)).toBeVisible({ timeout: 15_000 })

    // Daily reward can be claimed once.
    await page.goto('/rewards')
    await page.getByTestId('reward-daily').getByRole('button', { name: 'Забрать' }).click()
    await expect(page.getByTestId('reward-daily').getByText('Получено')).toBeVisible()

    await page.goto('/history')
    await expect(page.getByText('Пополнение').first()).toBeVisible()
    await expect(page.getByText('Открытие кейса').first()).toBeVisible()
    await expect(page.getByText('Апгрейд').first()).toBeVisible()

    // Logout
    await page.getByRole('button', { name: /demo|e2e_/ }).first().click()
    await page.getByRole('menuitem', { name: 'Выйти' }).click()
    await expect(page.getByRole('link', { name: 'Регистрация' })).toBeVisible()
    await page.goto('/inventory')
    await expect(page).toHaveURL(/\/login\?next=%2Finventory/)
  })

  test('wrong password is rejected with a clear message', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name=login]', uname)
    await page.fill('input[name=password]', 'wrong-password1')
    await page.click('button[type=submit]')
    await expect(page.getByText('Неверный логин или пароль')).toBeVisible()
  })
})

test('admin: case editor warns on invalid probability, balance adjust is audited', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name=login]', 'admin@graderup.local')
  await page.fill('input[name=password]', 'Admin12345!')
  await page.click('button[type=submit]')
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
