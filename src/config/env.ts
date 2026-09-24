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
  STEAM_AUTH_ENABLED: bool,
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
  KYC_WITHDRAW_THRESHOLD: z.coerce.number().nonnegative().default(500),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

/** Validated server-side configuration. Never import from client components. */
export function env(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment configuration: ${issues}`)
  }
  cached = parsed.data
  return cached
}
