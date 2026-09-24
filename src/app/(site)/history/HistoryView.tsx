'use client'

import { History } from 'lucide-react'
import { useState } from 'react'
import { HistoryTable, type HistoryRow } from '@/components/domain/HistoryTable'
import { PageHeader } from '@/components/domain/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { qs } from '@/lib/api'
import type { Paginated } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

const TABS = [
  { value: 'all', label: 'Все' },
  { value: 'case_open', label: 'Кейсы' },
  { value: 'upgrade', label: 'Апгрейды' },
  { value: 'sell', label: 'Продажи' },
  { value: 'deposit', label: 'Пополнения' },
  { value: 'withdraw', label: 'Выводы' },
  { value: 'reward', label: 'Награды' },
] as const
type Tab = (typeof TABS)[number]['value']

export function HistoryView() {
  const [type, setType] = useState<Tab>('all')
  const [page, setPage] = useState(1)
  const { data, error, loading, reload } = useFetch<Paginated<HistoryRow>>(`/api/history${qs({ type, page, pageSize: 20 })}`)
  return (
    <div className="container-page">
      <PageHeader title="История операций" description="Все изменения баланса и игровые операции." />
      <Tabs tabs={[...TABS]} value={type} onChange={(v) => { setType(v); setPage(1) }} className="mb-5" />
      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-96" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<History className="size-5" />} title="Операций пока нет" />
      ) : (
        <div className={loading ? 'opacity-60' : ''}>
          <HistoryTable rows={data.items} />
          <div className="mt-6">
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}
