import { NextResponse } from 'next/server'
import { steamProvider } from '@/server/auth/service'
import { Errors } from '@/server/http/errors'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { randomToken } from '@/server/security/crypto'

export const GET = route({ rateLimit: RateLimits.login }, async () => {
  const provider = steamProvider()
  if (!provider.isEnabled()) throw Errors.disabled('Вход через Steam не настроен')
  const state = randomToken(16)
  const res = NextResponse.redirect(provider.getAuthorizationUrl({ returnTo: '/', state }))
  res.cookies.set('gu_oauth_state', state, { httpOnly: true, sameSite: 'lax', path: '/api/auth/steam', maxAge: 600, secure: process.env.NODE_ENV === 'production' })
  return res
})
