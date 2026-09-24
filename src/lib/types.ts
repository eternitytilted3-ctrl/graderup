/** DTOs shared between server responses and client components. Money = string (2 dp). */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

export interface ItemDTO {
  id: string
  name: string
  image: string
  price: string
  rarity: Rarity
  description?: string
}

/** Case content entry. When odds are hidden, `price` and `chance` are empty strings. */
export interface CaseItemDTO extends ItemDTO {
  chance: string
}

export interface CaseDTO {
  id: string
  name: string
  slug: string
  description: string
  image: string
  price: string
  status: 'active' | 'disabled'
  isFeatured?: boolean
  categoryId?: string | null
  itemCount?: number
  topRarity?: Rarity
}

export interface InventoryItemDTO {
  id: string
  status: 'available' | 'locked' | 'sold' | 'used' | 'withdrawn'
  source: string
  createdAt: string
  item: ItemDTO
}

export interface PublicUserDTO {
  id: string
  username: string
  email: string | null
  avatarUrl: string | null
  role: 'user' | 'admin' | 'superadmin'
  balance: string
  referralCode: string
  createdAt: string
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CaseCategoryDTO {
  id: string
  name: string
  slug: string
}

export interface OpenCaseDrop {
  openingId: string
  userItemId: string
  item: ItemDTO
  reel: ItemDTO[]
  winIndex: number
  sellPrice: string
}

export interface OpenCasesResult {
  results: OpenCaseDrop[]
  balance: string
}

export interface OpenCaseResult extends OpenCaseDrop {
  balance: string
}

export interface UpgradeResultDTO {
  upgradeId: string
  result: 'win' | 'loss'
  chance: string
  roll: number
  /** Position on the dial, 0..1, derived from the server roll (visualization only). */
  rollFraction: number
  sources: ItemDTO[]
  sourceValue: string
  target: ItemDTO
  resultUserItemId: string | null
}

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
