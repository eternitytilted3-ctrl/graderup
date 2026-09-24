import { chromium } from '@playwright/test'
const [,, url, out, w = '1440', h = '900', full = '1'] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await b.newPage({ viewport: { width: +w, height: +h } })
const errors = []
p.on('console', m => m.type() === 'error' && errors.push(m.text()))
p.on('pageerror', e => errors.push(e.message))
await p.goto(url, { waitUntil: 'networkidle' })
await p.waitForTimeout(500)
await p.screenshot({ path: out, fullPage: full === '1' })
const sw = await p.evaluate(() => document.documentElement.scrollWidth)
console.log('scrollWidth', sw, 'errors', JSON.stringify(errors.slice(0,5)))
await b.close()
