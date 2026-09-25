import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { route } from '@/server/http/handler'
import { recentDrops } from '@/server/services/cases'
import { getSetting } from '@/server/services/settings'
import { touchVisitor, visitorsOnline } from '@/server/services/stats'

const VID_COOKIE = 'gu_vid'
const VID_RE = /^[A-Za-z0-9_-]{16,32}$/
let cache: { at: number; items: unknown; showOnline: boolean } | null = null

/** Real recent drops + real online (visitors seen in 5 min; hidden when site.showOnline is off). */
export const GET = route({}, async ({ req }) => {
  // Anonymous random visitor id — counts guests too; no personal data.
  const existing = req.cookies.get(VID_COOKIE)?.value
  const vid = existing && VID_RE.test(existing) ? existing : randomBytes(16).toString('base64url')
  await touchVisitor(vid).catch(() => {})
  if (!cache || Date.now() - cache.at > 4000) {
    const [items, site] = await Promise.all([recentDrops(30), getSetting('site')])
    cache = { at: Date.now(), items, showOnline: site.showOnline }
  }
  const online = cache.showOnline ? Math.max(1, await visitorsOnline()) : null
  const res = NextResponse.json({ items: cache.items, online }, { headers: { 'Cache-Control': 'private, max-age=3' } })
  if (vid !== existing) {
    res.cookies.set(VID_COOKIE, vid, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 365 * 86400, secure: (process.env.APP_URL ?? '').startsWith('https://') })
  }
  return res
})
