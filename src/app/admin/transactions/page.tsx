'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AdminTitle, DataTable } from '@/components/admin/ui'
import { Filter } from '@/components/ui/Filter'
import { Pagination } from '@/components/ui/Pagination'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { t } from '@/i18n/ru'
import { qs } from '@/lib/api'
import { formatDate } from '@/lib/format'
import type { Paginated } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

interface Row {
  id: string
  userId: string
  username: string
  type: keyof typeof t.txType
  amount: string
  balanceBefore: string
  balanceAfter: string
  referenceType: string | null
  referenceId: string | null
  status: string
  createdAt: string
}

export default function AdminTransactions() {
  const [type, setType] = useState<string>('all')
  const [page, setPage] = useState(1)
  const { data, error, reload } = useFetch<Paginated<Row>>(`/api/admin/transactions${qs({ page, pageSize: 30, type: type === 'all' ? undefined : type })}`)
  return (
    <>
      <AdminTitle title="Транзакции" description="Полный аудит изменений баланса: сумма, баланс до и после, ссылка на операцию." />
      <div className="mb-4">
        <Filter ariaLabel="Тип" value={type} onChange={(v) => { setType(v); setPage(1) }} options={[{ value: 'all', label: 'Все' }, ...Object.entries(t.txType).map(([value, label]) => ({ value, label }))]} />
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
              { key: 'd', label: 'Дата', render: (r) => <span className="text-muted whitespace-nowrap">{formatDate(r.createdAt)}</span> },
              { key: 'u', label: 'Пользователь', render: (r) => <Link className="text-accent hover:underline" href={`/admin/users/${r.userId}`}>{r.username}</Link> },
              { key: 't', label: 'Тип', render: (r) => t.txType[r.type] },
              { key: 'a', label: 'Сумма', render: (r) => <span className={`tnum ${Number(r.amount) > 0 ? 'text-success' : ''}`}>{r.amount}</span> },
              { key: 'b', label: 'До → После', render: (r) => <span className="text-muted tnum">{r.balanceBefore} → {r.balanceAfter}</span> },
              { key: 'r', label: 'Reference', render: (r) => <span className="font-mono text-[11px] text-subtle">{r.referenceType}:{r.referenceId?.slice(0, 8)}</span> },
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
