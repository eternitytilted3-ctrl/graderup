import 'server-only'
import type { ItemDTO, PublicUserDTO, Rarity } from '@/lib/types'
import type { items, users } from '../db/schema'

export function toItemDTO(i: typeof items.$inferSelect, withDescription = false): ItemDTO {
  return {
    id: i.id,
    name: i.name,
    image: i.image,
    price: i.price,
    rarity: i.rarity as Rarity,
    ...(withDescription ? { description: i.description } : {}),
  }
}

export function toPublicUser(u: typeof users.$inferSelect): PublicUserDTO {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    balance: u.balance,
    referralCode: u.referralCode,
    createdAt: u.createdAt.toISOString(),
  }
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}
