import { NextResponse } from 'next/server'
import { clearSessionCookies, destroySession } from '@/server/auth/session'
import { applyCookies } from '@/server/http/cookies'
import { route } from '@/server/http/handler'
import { logEvent } from '@/server/services/log'

export const POST = route({ auth: 'optional' }, async ({ auth, ip }) => {
  if (auth) {
    await destroySession(auth.sessionId)
    void logEvent('logout', { userId: auth.user.id, ip })
  }
  return applyCookies(NextResponse.json({ ok: true }), clearSessionCookies())
})
