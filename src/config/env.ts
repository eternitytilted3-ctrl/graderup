import { z } from 'zod'

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().optional(),
  APP_NAME: z.string().default('GraderUP'),
  DATABASE_URL: z.string().min(1).default('postgres://graderup:graderup@localhost:5432/graderup'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  TRUST_PROXY: bool,
  PAYMENT_PROVIDER: z.enum(['mock', 'real']).default('mock'),
  PAYMENT_SECRET: z.string().min(16),
  ALLOW_MOCK_PAYMENTS_IN_PRODUCTION: bool,
  REAL_PAYMENT_API_URL: z.string().optional(),
  REAL_PAYMENT_API_KEY: z.string().optional(),
  REAL_PAYMENT_MERCHANT_ID: z.string().optional(),
  /** Steam OpenID needs no key, so it is on unless explicitly disabled. */
  PALLY_API_TOKEN: z.string().optional(),
  PALLY_SHOP_ID: z.string().optional(),
  PALLY_API_URL: z.string().url().default('https://pal24.pro/api/v1'),
  ANYPAY_MERCHANT_ID: z.string().optional(),
  ANYPAY_SECRET_KEY: z.string().optional(),
  ANYPAY_ALLOWED_IPS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  XROCKET_API_KEY: z.string().optional(),
  XROCKET_API_URL: z.string().url().default('https://pay.xrocket.tg'),
  XROCKET_CURRENCY: z.string().default('USDT'),
  /** How many coins (₽) one unit of XROCKET_CURRENCY is worth, e.g. 95 for USDT. */
  XROCKET_COINS_PER_UNIT: z.coerce.number().positive().default(95),
  /** Skin withdrawal to Steam: 'mock' (dev simulation) | 'none'. Real adapters: see src/server/trades. */
  TRADE_PROVIDER: z.enum(['none', 'mock', 'marketcsgo']).default('mock'),
  /** market.csgo.com "buy-for" delivery (TRADE_PROVIDER=marketcsgo). */
  MARKETCSGO_API_KEY: z.string().optional(),
  MARKETCSGO_API_URL: z.string().url().default('https://market.csgo.com/api/v2'),
  /** How much above the item price the site agrees to pay on the market, %. */
  MARKETCSGO_MAX_OVERPAY_PERCENT: z.coerce.number().min(0).max(100).default(10),
  ALLOW_MOCK_TRADES_IN_PRODUCTION: bool,
  STEAM_AUTH_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  /** Public email/password sign-up. Off by default: users sign in with Steam; email login stays for admins. */
  EMAIL_REGISTRATION_ENABLED: bool,
  STEAM_CLIENT_ID: z.string().optional(),
  STEAM_CLIENT_SECRET: z.string().optional(),
  STEAM_API_KEY: z.string().optional(),
  FEATURE_WITHDRAW: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  MIN_AGE: z.coerce.number().int().min(0).default(18),
  RESTRICTED_COUNTRIES: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  COUNTRY_HEADER: z.string().optional(),
  KYC_PROVIDER: z.string().default('none'),
  KYC_WITHDRAW_THRESHOLD: z.coerce.number().nonnegative().default(50000),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

/** Validated server-side configuration. Never import from client components. */
const DEV_FALLBACKS: Record<string, string> = {
  SESSION_SECRET: 'dev-only-session-secret-change-me-0123456789',
  PAYMENT_SECRET: 'dev-only-payment-secret-change-me',
}

export function env(): Env {
  if (cached) return cached
  const source: Record<string, string | undefined> = { ...process.env }
  // Outside production, missing secrets fall back to dev values (with a warning) so a
  // half-filled .env does not break local development. Production always requires them.
  if (process.env.NODE_ENV !== 'production') {
    for (const [k, v] of Object.entries(DEV_FALLBACKS)) {
      if (!source[k] || source[k]!.length < (k === 'SESSION_SECRET' ? 32 : 16)) {
        console.warn(`[env] ${k} is missing or too short — using an insecure development value. Set it in .env.`)
        source[k] = v
      }
    }
  }
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment configuration: ${issues}`)
  }
  cached = parsed.data
  return cached
}
