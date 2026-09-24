import { expect, test } from '@playwright/test'

const widths = [320, 375, 390, 768, 1024, 1440]
const pages = ['/', '/cases', '/cases/magnum', '/upgrade', '/faq', '/login', '/terms']

for (const w of widths) {
  test(`no horizontal overflow at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 800 })
    for (const p of pages) {
      await page.goto(p)
      const sw = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(sw, `${p} @ ${w}px`).toBeLessThanOrEqual(w)
    }
  })
}
