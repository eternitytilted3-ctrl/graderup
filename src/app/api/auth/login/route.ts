import { NextResponse } from 'next/server'
import { createSession } from '@/server/auth/session'
import { emailProvider } from '@/server/auth/service'
import { loginSchema } from '@/server/auth/validation'
import { AppError } from '@/server/http/errors'
import { applyCookies } from '@/server/http/cookies'
import { route } from '@/server/http/handler'
import { enforceRateLimit, RateLimits } from '@/server/security/rateLimit'
import { userAgent } from '@/server/security/request'
import { logEvent } from '@/server/services/log'

export const POST = route({ body: loginSchema, rateLimit: RateLimits.login }, async ({ body, ip, req }) => {
  // Second bucket keyed by the account identifier: slows distributed brute force on one account.
  await enforceRateLimit(RateLimits.loginAccount, `acc:${body.login.toLowerCase()}`)
  try {
    const { userId } = await emailProvider.authenticate(body)
    const session = await createSession(userId, { ip, userAgent: userAgent(req) })
    void logEvent('login', { userId, ip, details: { provider: 'email' } })
    return applyCookies(NextResponse.json({ ok: true }), session.cookies)
  } catch (err) {
    if (err instanceof AppError) {
      void logEvent('login_failed', { level: 'security', ip, details: { login: body.login.slice(0, 64), code: err.code } })
    }
    throw err
  }
})
