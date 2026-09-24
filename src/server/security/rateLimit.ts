import 'server-only'
import { sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { Errors } from '../http/errors'

export interface RateLimitRule {
  /** Bucket name, e.g. "login". */
  name: string
  limit: number
  windowSec: number
}

/**
 * Fixed-window counter stored in Postgres so limits hold across multiple app instances.
 * Throws AppError(429) when exceeded.
 */
export async function enforceRateLimit(rule: RateLimitRule, subject: string): Promise<void> {
  const now = Date.now()
  const windowMs = rule.windowSec * 1000
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs)
  const key = `${rule.name}:${subject}`.slice(0, 200)
  const db = getDb()
  const res = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${windowStart.toISOString()}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`)
  const count = Number(res.rows[0]?.count ?? 0)
  // Opportunistic cleanup of expired windows (~1% of calls).
  if (Math.random() < 0.01) {
    await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`).catch(() => {})
  }
  if (count > rule.limit) {
    const retryAfter = Math.ceil((windowStart.getTime() + windowMs - now) / 1000)
    throw Errors.rateLimited(retryAfter)
  }
}

export const RateLimits = {
  login: { name: 'login', limit: 10, windowSec: 300 },
  loginAccount: { name: 'login-acc', limit: 8, windowSec: 900 },
  register: { name: 'register', limit: 5, windowSec: 3600 },
  caseOpen: { name: 'case-open', limit: 60, windowSec: 60 },
  upgrade: { name: 'upgrade', limit: 60, windowSec: 60 },
  sell: { name: 'sell', limit: 120, windowSec: 60 },
  claim: { name: 'claim', limit: 20, windowSec: 60 },
  promo: { name: 'promo', limit: 10, windowSec: 600 },
  payment: { name: 'payment', limit: 20, windowSec: 600 },
  withdraw: { name: 'withdraw', limit: 5, windowSec: 3600 },
  admin: { name: 'admin', limit: 300, windowSec: 60 },
  read: { name: 'read', limit: 300, windowSec: 60 },
} satisfies Record<string, RateLimitRule>
