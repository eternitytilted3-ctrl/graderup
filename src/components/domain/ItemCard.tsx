import Image from 'next/image'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/money'
import type { ItemDTO } from '@/lib/types'
import { RarityBadge } from './RarityBadge'

/**
 * Base item card. Rarity drives the bottom strip, radial glow and hover border via --r.
 */
export function ItemCard({
  item,
  chance,
  selected,
  onClick,
  footer,
  topRight,
  size = 'md',
  className,
  dimmed,
}: {
  item: ItemDTO
  chance?: string
  selected?: boolean
  onClick?: () => void
  footer?: ReactNode
  topRight?: ReactNode
  size?: 'sm' | 'md'
  className?: string
  dimmed?: boolean
}) {
  const Comp = onClick ? 'button' : 'div'
  const [weapon, finish] = item.name.split(' | ')
  return (
    <Comp
      data-rarity={item.rarity}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      aria-pressed={onClick ? Boolean(selected) : undefined}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-[var(--radius-lg)] border bg-card text-left transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--r)_55%,transparent)] hover:shadow-[0_10px_30px_-12px_color-mix(in_srgb,var(--r)_55%,transparent)]',
        selected ? 'border-[var(--r)] shadow-[0_0_0_1px_var(--r),0_10px_30px_-10px_color-mix(in_srgb,var(--r)_70%,transparent)]' : 'border-border',
        onClick && 'cursor-pointer',
        dimmed && 'opacity-45',
        className,
      )}
    >
      <div className={cn('relative flex items-center justify-center', size === 'sm' ? 'h-20' : 'h-28 sm:h-32')}>
        <div
          className="absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: 'radial-gradient(60% 70% at 50% 60%, color-mix(in srgb, var(--r) 28%, transparent), transparent 70%)' }}
        />
        <Image
          src={item.image}
          alt={item.name}
          width={200}
          height={140}
          className={cn('relative w-auto object-contain transition-transform duration-300 group-hover:scale-[1.06] group-hover:-rotate-2', size === 'sm' ? 'h-14' : 'h-20 sm:h-24')}
          loading="lazy"
        />
        {chance && (
          <span className="absolute top-2 left-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted tnum backdrop-blur">{Number(chance) < 0.01 ? '<0.01' : Number(chance).toFixed(2)}%</span>
        )}
        {topRight && <div className="absolute top-2 right-2">{topRight}</div>}
      </div>
      <div className={cn('flex flex-1 flex-col gap-1 border-t border-white/[0.04]', size === 'sm' ? 'px-2.5 py-2' : 'px-3 py-2.5')}>
        <RarityBadge rarity={item.rarity} />
        <div className="min-w-0">
          <div className={cn('truncate font-semibold', size === 'sm' ? 'text-xs' : 'text-[13px]')} title={item.name}>
            {weapon}
          </div>
          {finish && <div className="truncate text-[11px] text-muted">{finish}</div>}
        </div>
        <div className={cn('mt-auto pt-1 font-display font-bold text-text tnum', size === 'sm' ? 'text-xs' : 'text-sm')}>{formatMoney(item.price)}</div>
        {footer}
      </div>
      <span className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, var(--r), transparent)' }} />
    </Comp>
  )
}
