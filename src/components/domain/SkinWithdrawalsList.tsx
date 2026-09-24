'use client'

import { Check, ExternalLink, Loader2, Search, X } from 'lucide-react'
import Image from 'next/image'
import { useEffect } from 'react'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { ItemDTO } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'
import { RarityBadge } from './RarityBadge'

interface W {
  id: string
  status: 'searching' | 'waiting_accept' | 'completed' | 'failed' | 'cancelled'
  message: string | null
  tradeOfferId: string | null
  price: string
  createdAt: string
  item: ItemDTO
}

const STEPS = [
  { key: 'searching', label: 'Ищем продавца' },
  { key: 'waiting_accept', label: 'Примите трейд' },
  { key: 'completed', label: 'Выведено' },
] as const

function Stepper({ status }: { status: W['status'] }) {
  if (status === 'failed' || status === 'cancelled')
    return (
      <div className="flex items-center gap-1.5 text-xs text-danger">
        <X className="size-3.5" /> {status === 'failed' ? 'Не удалось — предмет возвращён' : 'Отменено — предмет возвращён'}
      </div>
    )
  const idx = STEPS.findIndex((s) => s.key === status)
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-label="Статус вывода">
      {STEPS.map((s, i) => (
        <li key={s.key} className={cn('flex items-center gap-1.5', i < idx ? 'text-success' : i === idx ? 'text-text' : 'text-subtle')}>
          <span className={cn('grid size-5 place-items-center rounded-full border', i < idx || status === 'completed' ? 'border-success bg-success/15' : i === idx ? 'border-accent' : 'border-border')}>
            {i < idx || status === 'completed' ? <Check className="size-3" /> : i === idx ? <Loader2 className="size-3 animate-spin text-accent" /> : null}
          </span>
          {s.label}
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-border" aria-hidden />}
        </li>
      ))}
    </ol>
  )
}

export function SkinWithdrawalsList() {
  const { data, error, reload } = useFetch<{ items: W[]; config: { enabled: boolean } }>('/api/skins/withdrawals')
  const active = data?.items.some((w) => w.status === 'searching' || w.status === 'waiting_accept')
  // Poll while something is in progress.
  useEffect(() => {
    if (!active) return
    const id = setInterval(reload, 4000)
    return () => clearInterval(id)
  }, [active, reload])

  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <Skeleton className="h-60" />
  if (data.items.length === 0)
    return <EmptyState icon={<Search className="size-5" />} title="Выводов скинов пока нет" description="Выберите скин в инвентаре и нажмите «Вывести в Steam»." />
  return (
    <ul className="card divide-y divide-border" data-testid="skin-withdrawals">
      {data.items.map((w) => (
        <li key={w.id} data-rarity={w.item.rarity} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="slot-bg relative grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)]">
            <Image src={w.item.image} alt="" width={120} height={84} className="h-10 w-auto object-contain" />
            <span className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: 'var(--r)' }} />
          </div>
          <div className="min-w-0 flex-1">
            <RarityBadge rarity={w.item.rarity} />
            <div className="truncate text-sm font-semibold">{w.item.name}</div>
            <div className="text-xs text-muted">
              {formatMoney(w.price)} · {formatDate(w.createdAt)}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:items-end">
            <Stepper status={w.status} />
            {w.status === 'waiting_accept' && (
              <a href="https://steamcommunity.com/my/tradeoffers/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                Открыть предложения обмена в Steam <ExternalLink className="size-3" />
              </a>
            )}
            {w.status === 'completed' && (
              <span className="text-xs font-semibold text-success" data-testid="skin-withdraw-done">
                Выведено
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
