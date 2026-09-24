'use client'

import { Check, Coins, Info, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { InventoryItemDTO } from '@/lib/types'
import { Tooltip } from '../ui/Tooltip'
import { ItemCard } from './ItemCard'

export function InventoryCard({
  entry,
  sellPrice,
  selected,
  selectMode,
  onToggle,
  onSell,
  onDetails,
  busy,
}: {
  entry: InventoryItemDTO
  sellPrice: string
  selected: boolean
  selectMode: boolean
  onToggle: () => void
  onSell: () => void
  onDetails: () => void
  busy?: boolean
}) {
  return (
    <ItemCard
      item={entry.item}
      selected={selected}
      onClick={selectMode ? onToggle : undefined}
      topRight={
        selectMode ? (
          <span className={`grid size-5 place-items-center rounded border ${selected ? 'border-primary bg-primary' : 'border-border-strong bg-black/40'}`}>{selected && <Check className="size-3.5" />}</span>
        ) : undefined
      }
      footer={
        <>
          <div className="text-[10px] text-subtle">{formatDate(entry.createdAt, false)}</div>
          {!selectMode && (
            <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-1.5">
              <button
                onClick={onSell}
                disabled={busy}
                className="flex h-8 items-center justify-center gap-1 rounded-md bg-white/[0.05] text-[11px] font-semibold text-text transition hover:bg-success/15 hover:text-success disabled:opacity-50"
                aria-label={`Продать за ${formatMoney(sellPrice)}`}
              >
                <Coins className="size-3.5" /> <span className="tnum">{formatMoney(sellPrice)}</span>
              </button>
              <Tooltip content="Апгрейд">
                <Link href={`/upgrade?item=${entry.id}`} className="grid size-8 place-items-center rounded-md bg-white/[0.05] text-muted transition hover:bg-primary/20 hover:text-text" aria-label="Апгрейд">
                  <TrendingUp className="size-3.5" />
                </Link>
              </Tooltip>
              <Tooltip content="Подробнее">
                <button onClick={onDetails} className="grid size-8 place-items-center rounded-md bg-white/[0.05] text-muted transition hover:bg-white/10 hover:text-text" aria-label="Подробнее">
                  <Info className="size-3.5" />
                </button>
              </Tooltip>
            </div>
          )}
        </>
      }
    />
  )
}
