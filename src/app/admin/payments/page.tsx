'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AdminTitle, DataTable } from '@/components/admin/ui'
import { Badge } from '@/components/ui/Badge'
import { Filter } from '@/components/ui/Filter'
import { Pagination } from '@/components/ui/Pagination'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { t } from '@/i18n/ru'
import { qs } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { Paginated } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

interface Row {
  id: string
  userId: string
  username: string
  provider: string
  externalId: string | null
  amount: string
  bonusAmount: string
  status: keyof typeof t.paymentStatus
  createdAt: string
}

export default function AdminPayments() {
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const { data, error, reload } = useFetch<Paginated<Row>>(`/api/admin/payments${qs({ page, pageSize: 25, status: status === 'all' ? undefined : status })}`)
  return (
    <>
      <AdminTitle title="Платежи" description="Зачисление происходит только по подписанному webhook провайдера." />
      <div className="mb-4">
        <Filter ariaLabel="Статус" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ value: 'all', label: 'Все' }, ...Object.entries(t.paymentStatus).map(([value, label]) => ({ value, label }))]} />
      </div>
      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <>
          <DataTable
            rows={data.items}
            columns={[
              { key: 'd', label: 'Дата', render: (r) => <span className="text-muted">{formatDate(r.createdAt)}</span> },
              { key: 'u', label: 'Пользователь', render: (r) => <Link className="text-accent hover:underline" href={`/admin/users/${r.userId}`}>{r.username}</Link> },
              { key: 'a', label: 'Сумма', render: (r) => <span className="tnum">{formatMoney(r.amount)}</span> },
              { key: 'b', label: 'Бонус', render: (r) => <span className="text-muted tnum">{Number(r.bonusAmount) ? formatMoney(r.bonusAmount) : '—'}</span> },
              { key: 'p', label: 'Провайдер', render: (r) => r.provider },
              { key: 'e', label: 'External ID', render: (r) => <span className="font-mono text-xs text-muted">{r.externalId ?? '—'}</span> },
              { key: 's', label: 'Статус', render: (r) => <Badge tone={r.status === 'completed' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}>{t.paymentStatus[r.status]}</Badge> },
            ]}
          />
          <div className="mt-4">
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </>
  )
}
