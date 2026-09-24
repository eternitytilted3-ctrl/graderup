import { NextResponse } from 'next/server'
import { route } from '@/server/http/handler'
import { recentDrops } from '@/server/services/cases'
import { usersOnline } from '@/server/services/stats'

let cache: { at: number; data: unknown } | null = null

export const GET = route({}, async () => {
  if (!cache || Date.now() - cache.at > 4000) {
    const [items, online] = await Promise.all([recentDrops(20), usersOnline()])
    cache = { at: Date.now(), data: { items, online } }
  }
  return NextResponse.json(cache.data, { headers: { 'Cache-Control': 'public, max-age=3' } })
})
