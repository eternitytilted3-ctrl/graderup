// Dev helper: full-page screenshots. Usage: node scripts/screenshots.mjs http://localhost:3000 ./screenshots 390 "/,/cases" [login:password]
import { chromium } from '@playwright/test'
// usage: node .shot2.mjs base outdir width "path1,path2" [login]
const [,, base, outdir, w, paths, login] = process.argv
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const ctx = await b.newContext({ viewport: { width: +w, height: 900 } })
const p = await ctx.newPage()
const errors = []
p.on('pageerror', e => errors.push(e.message))
if (login) {
  await p.goto(base + '/login'); await p.getByRole('button', { name: /Вход по email/ }).click(); await p.fill('input[name=login]', login.split(':')[0]); await p.fill('input[name=password]', login.split(':')[1])
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 })
}
for (const path of paths.split(',')) {
  await p.goto(base + path, { waitUntil: 'networkidle' })
  // Scroll through the page so lazy images load before the full-page shot.
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)) } window.scrollTo(0, 0) })
  await p.waitForTimeout(600)
  const name = (path.replace(/[\/?=&]/g, '_') || '_home') + `-${w}.png`
  await p.screenshot({ path: `${outdir}/${name}`, fullPage: true })
  const sw = await p.evaluate(() => document.documentElement.scrollWidth)
  console.log(name, 'scrollW', sw)
}
console.log('errors', JSON.stringify(errors.slice(0, 5)))
await b.close()
