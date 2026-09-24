import { NextResponse } from 'next/server'
import { route } from '@/server/http/handler'
import { recentDrops } from '@/server/services/cases'

let cache: { at: number; data: unknown } | null = null

export const GET = route({}, async () => {
  if (!cache || Date.now() - cache.at > 4000) cache = { at: Date.now(), data: { items: await recentDrops(20) } }
  return NextResponse.json(cache.data, { headers: { 'Cache-Control': 'public, max-age=3' } })
})
