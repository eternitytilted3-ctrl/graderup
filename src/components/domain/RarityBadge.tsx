import { t } from '@/i18n/ru'
import { cn } from '@/lib/cn'
import type { Rarity } from '@/lib/types'

export const rarityColor: Record<Rarity, string> = {
  common: '#9aa4b5',
  uncommon: '#36d6a8',
  rare: '#3ea8ff',
  epic: '#9b6bff',
  legendary: '#ffb547',
  mythic: '#ff4f8b',
}

export function RarityBadge({ rarity, className }: { rarity: Rarity; className?: string }) {
  return (
    <span data-rarity={rarity} className={cn('inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.08em] uppercase', className)} style={{ color: 'var(--r)' }}>
      <span className="size-1.5 rounded-full" style={{ background: 'var(--r)', boxShadow: '0 0 8px var(--r)' }} />
      {t.rarity[rarity]}
    </span>
  )
}
