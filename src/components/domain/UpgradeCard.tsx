import { Plus, X } from 'lucide-react'
import Image from 'next/image'
import { formatMoney } from '@/lib/money'
import type { ItemDTO } from '@/lib/types'
import { RarityBadge } from './RarityBadge'

/** Slot used on the Upgrade screen for the SOURCE / TARGET item. */
export function UpgradeCard({ label, item, placeholder, onClear, highlight }: { label: string; item: ItemDTO | null; placeholder: string; onClear?: () => void; highlight?: 'win' | 'loss' | null }) {
  return (
    <div
      data-rarity={item?.rarity ?? 'common'}
      className={`relative flex h-full min-h-52 flex-col overflow-hidden rounded-[var(--radius-xl)] border bg-card p-4 transition-all duration-300 ${
        highlight === 'win' ? 'border-success shadow-[0_0_40px_-8px_rgb(53_208_127/0.7)]' : highlight === 'loss' ? 'border-danger/70 opacity-70' : item ? 'border-[color-mix(in_srgb,var(--r)_45%,transparent)]' : 'border-dashed border-border-strong'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        {item && onClear && (
          <button onClick={onClear} className="rounded p-1 text-subtle hover:bg-white/5 hover:text-text" aria-label="Убрать">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {item ? (
        <>
          <div className="relative flex flex-1 items-center justify-center py-3">
            <div className="absolute inset-0" style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--r) 30%, transparent), transparent)' }} />
            <Image src={item.image} alt={item.name} width={320} height={240} className="relative h-36 w-auto max-w-full animate-pop object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] sm:h-44" />
          </div>
          <RarityBadge rarity={item.rarity} />
          <div className="mt-1 truncate text-sm font-semibold" title={item.name}>
            {item.name}
          </div>
          <div className="mt-1 font-display text-lg font-bold tnum">{formatMoney(item.price)}</div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-subtle">
          <span className="grid size-10 place-items-center rounded-full border border-dashed border-border-strong">
            <Plus className="size-4" />
          </span>
          {placeholder}
        </div>
      )}
    </div>
  )
}
