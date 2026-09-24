import { z } from 'zod'
import { RARITIES } from '@/lib/types'

export const uuidParam = z.uuid()

/** Only site-relative asset paths or https URLs are accepted for images (no javascript:, data:, etc). */
export const imageSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      /^\/assets\/[a-zA-Z0-9/_.-]+\.(svg|png|webp|jpg|jpeg)$/.test(v) ||
      /^\/api\/uploads\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(v) ||
      /^https:\/\/[^\s"'<>]+$/.test(v),
    'Путь /assets/..., загруженный файл или https:// URL',
  )

export const moneyNumber = z.number().multipleOf(0.01)

export const itemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  image: imageSchema,
  price: moneyNumber.positive().max(1_000_000),
  rarity: z.enum(RARITIES as ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
  marketHashName: z.string().trim().max(200).nullable().optional(),
  priceLocked: z.boolean().optional(),
})

export const caseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Только a-z, 0-9 и -'),
  description: z.string().trim().max(2000).optional(),
  image: imageSchema,
  price: moneyNumber.positive().max(100_000),
  status: z.enum(['active', 'disabled']),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isFeatured: z.boolean().optional(),
  categoryId: z.uuid().nullable().optional(),
})

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Только a-z, 0-9 и -'),
  sortOrder: z.number().int().min(0).max(10_000),
  isActive: z.boolean(),
})

export const caseItemsSchema = z.object({
  items: z
    .array(z.object({ itemId: z.uuid(), dropWeight: z.number().int().min(1).max(100_000_000) }))
    .max(200),
})

export const rewardSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500),
  amount: moneyNumber.min(0).max(10_000),
  cooldownSeconds: z.number().int().min(0).max(365 * 86400),
  minDepositTotal: moneyNumber.min(0).max(1_000_000),
  isActive: z.boolean(),
})

export const promocodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(['fixed', 'percentage', 'item']),
  value: moneyNumber.min(0).max(100_000),
  itemId: z.uuid().nullable().optional(),
  maxUses: z.number().int().min(1).max(10_000_000),
  expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
  active: z.boolean(),
})
