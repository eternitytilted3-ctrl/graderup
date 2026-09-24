import { NextResponse } from 'next/server'
import { route } from '@/server/http/handler'
import { recentDrops } from '@/server/services/cases'
import { getSetting } from '@/server/services/settings'
import { usersOnline } from '@/server/services/stats'

let cache: { at: number; data: unknown } | null = null

/** Real recent drops + real online count (hidden when site.showOnline is off). */
export const GET = route({}, async () => {
  if (!cache || Date.now() - cache.at > 4000) {
    const [items, online, site] = await Promise.all([recentDrops(30), usersOnline(), getSetting('site')])
    cache = { at: Date.now(), data: { items, online: site.showOnline ? online : null } }
  }
  return NextResponse.json(cache.data, { headers: { 'Cache-Control': 'public, max-age=3' } })
})
