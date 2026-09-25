import { NextResponse } from 'next/server'
import { steamProvider } from '@/server/auth/service'
import { Errors } from '@/server/http/errors'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { randomToken } from '@/server/security/crypto'
import { COOKIES } from '@/lib/cookies'

const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, path: '/api/auth/steam', maxAge: 600, secure: (process.env.APP_URL ?? '').startsWith('https://') }

/** Starts Steam OpenID sign-in. Optional ?ref=CODE (referral) and ?next=/path are kept in short-lived cookies. */
export const GET = route({ rateLimit: RateLimits.login }, async ({ req }) => {
  const provider = steamProvider()
  if (!provider.isEnabled()) throw Errors.disabled('Вход через Steam не настроен')
  const state = randomToken(16)
  const res = NextResponse.redirect(provider.getAuthorizationUrl({ returnTo: '/', state }))
  res.cookies.set(COOKIES.oauthState, state, cookieOpts)
  const ref = req.nextUrl.searchParams.get('ref')
  if (ref && /^[A-Za-z0-9]{3,16}$/.test(ref)) res.cookies.set(COOKIES.ref, ref, cookieOpts)
  const next = req.nextUrl.searchParams.get('next')
  if (next && next.startsWith('/') && !next.startsWith('//') && next.length < 200) res.cookies.set(COOKIES.next, next, cookieOpts)
  return res
})
