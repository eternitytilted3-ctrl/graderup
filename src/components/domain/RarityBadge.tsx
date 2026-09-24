import { t } from '@/i18n/ru'
import { cn } from '@/lib/cn'
import type { Rarity } from '@/lib/types'

export const rarityColor: Record<Rarity, string> = {
  common: '#b0c3d9',
  uncommon: '#5e98d9',
  rare: '#4b69ff',
  epic: '#8847ff',
  legendary: '#d32ce6',
  mythic: '#e4ae39',
}

export function RarityBadge({ rarity, className }: { rarity: Rarity; className?: string }) {
  return (
    <span data-rarity={rarity} className={cn('inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.08em] uppercase', className)} style={{ color: 'var(--r)' }}>
      <span className="size-1.5 rounded-full" style={{ background: 'var(--r)', boxShadow: '0 0 8px var(--r)' }} />
      {t.rarity[rarity]}
    </span>
  )
}
