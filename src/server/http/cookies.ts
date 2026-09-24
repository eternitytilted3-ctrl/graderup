import 'server-only'
import type { NextResponse } from 'next/server'
import type { CookieSpec } from '../auth/session'

export function applyCookies(res: NextResponse, specs: CookieSpec[]) {
  for (const c of specs) res.cookies.set(c.name, c.value, c.options)
  return res
}
