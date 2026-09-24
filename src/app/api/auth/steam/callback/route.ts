import { NextResponse } from 'next/server'
import { env } from '@/config/env'
import { createSession } from '@/server/auth/session'
import { loginWithExternalIdentity, steamProvider } from '@/server/auth/service'
import { applyCookies } from '@/server/http/cookies'
import { route } from '@/server/http/handler'
import { safeEqual } from '@/server/security/crypto'
import { RateLimits } from '@/server/security/rateLimit'
import { userAgent } from '@/server/security/request'
import { logEvent } from '@/server/services/log'

export const GET = route({ rateLimit: RateLimits.login }, async ({ req, ip }) => {
  const appUrl = env().APP_URL
  const fail = (reason: string) => {
    void logEvent('steam_login_failed', { level: 'security', ip, details: { reason } })
    return NextResponse.redirect(`${appUrl}/login?error=steam`)
  }
  const provider = steamProvider()
  if (!provider.isEnabled()) return fail('disabled')
  const state = req.nextUrl.searchParams.get('state') ?? ''
  const expected = req.cookies.get('gu_oauth_state')?.value ?? ''
  if (!state || !safeEqual(state, expected)) return fail('state')
  try {
    const identity = await provider.handleCallback(req.nextUrl)
    const { userId, created } = await loginWithExternalIdentity(identity, req.cookies.get('gu_ref')?.value)
    const session = await createSession(userId, { ip, userAgent: userAgent(req) })
    void logEvent(created ? 'register' : 'login', { userId, ip, details: { provider: 'steam' } })
    const next = req.cookies.get('gu_next')?.value
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
    const res = NextResponse.redirect(`${appUrl}${safeNext}`)
    for (const c of ['gu_oauth_state', 'gu_ref', 'gu_next']) res.cookies.set(c, '', { path: '/api/auth/steam', maxAge: 0 })
    return applyCookies(res, session.cookies)
  } catch (err) {
    return fail((err as Error).message.slice(0, 120))
  }
})
