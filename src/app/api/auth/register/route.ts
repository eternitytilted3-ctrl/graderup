import { NextResponse } from 'next/server'
import { createSession } from '@/server/auth/session'
import { emailProvider } from '@/server/auth/service'
import { registerSchema } from '@/server/auth/validation'
import { applyCookies } from '@/server/http/cookies'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { userAgent } from '@/server/security/request'
import { logEvent } from '@/server/services/log'

export const POST = route({ body: registerSchema, rateLimit: RateLimits.register, restricted: true }, async ({ body, ip, req }) => {
  const { userId } = await emailProvider.register(body)
  const session = await createSession(userId, { ip, userAgent: userAgent(req) })
  void logEvent('register', { userId, ip, details: { provider: 'email', referral: Boolean(body.referralCode) } })
  return applyCookies(NextResponse.json({ ok: true }, { status: 201 }), session.cookies)
})
