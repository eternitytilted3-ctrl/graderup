import { Badge } from '@/components/ui/Badge'
import { t } from '@/i18n/ru'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { Rarity } from '@/lib/types'
import { rarityColor } from './RarityBadge'

export interface HistoryRow {
  id: string
  type: keyof typeof t.txType
  amount: string
  balanceAfter: string
  status: string
  createdAt: string
  itemName: string | null
  rarity: string | null
  details: string | null
}

const statusTone = { completed: 'success', pending: 'warning', failed: 'danger', reversed: 'neutral' } as const
const statusLabel = { completed: 'Выполнено', pending: 'В обработке', failed: 'Ошибка', reversed: 'Отменено' } as const

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="hidden grid-cols-[150px_150px_1fr_120px_110px] gap-4 border-b border-border px-4 py-3 text-xs font-medium text-muted md:grid">
        <span>Дата</span>
        <span>Тип</span>
        <span>Предмет / детали</span>
        <span className="text-right">Сумма</span>
        <span className="text-right">Статус</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const n = Number(r.amount)
          return (
            <li key={r.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 text-sm md:grid-cols-[150px_150px_1fr_120px_110px] md:items-center">
              <span className="order-3 text-xs text-muted md:order-none md:text-sm">{formatDate(r.createdAt)}</span>
              <span className="order-1 font-medium md:order-none">{t.txType[r.type] ?? r.type}</span>
              <span className="order-4 col-span-2 min-w-0 truncate text-muted md:order-none md:col-span-1">
                {r.itemName && (
                  <span className="font-medium" style={{ color: r.rarity ? rarityColor[r.rarity as Rarity] : undefined }}>
                    {r.itemName}
                  </span>
                )}
                {r.itemName && r.details ? ' · ' : ''}
                {r.details}
                {!r.itemName && !r.details && '—'}
              </span>
              <span className={cn('order-2 text-right font-semibold tnum md:order-none', n > 0 ? 'text-success' : n < 0 ? 'text-text' : 'text-muted')}>
                {n > 0 ? '+' : n < 0 ? '−' : ''}
                {formatMoney(Math.abs(n))}
              </span>
              <span className="order-5 hidden text-right md:order-none md:block">
                <Badge tone={statusTone[r.status as keyof typeof statusTone] ?? 'neutral'}>{statusLabel[r.status as keyof typeof statusLabel] ?? r.status}</Badge>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
