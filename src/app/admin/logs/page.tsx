'use client'

import { useState } from 'react'
import { AdminTitle, DataTable } from '@/components/admin/ui'
import { Badge } from '@/components/ui/Badge'
import { Filter } from '@/components/ui/Filter'
import { Pagination } from '@/components/ui/Pagination'
import { Search } from '@/components/ui/Search'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { qs } from '@/lib/api'
import { formatDate } from '@/lib/format'
import type { Paginated } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

interface Row {
  id: number
  level?: string
  event?: string
  action?: string
  username: string | null
  ip: string | null
  targetType?: string | null
  targetId?: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

export default function AdminLogs() {
  const [kind, setKind] = useState<'events' | 'admin'>('events')
  const [level, setLevel] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, error, reload } = useFetch<Paginated<Row>>(`/api/admin/logs${qs({ kind, page, pageSize: 40, q, level: kind === 'events' && level !== 'all' ? level : undefined })}`)
  return (
    <>
      <AdminTitle title="Логи" actions={<Search value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Событие / действие" className="w-60" />} />
      <Tabs className="mb-4" value={kind} onChange={(v) => { setKind(v); setPage(1) }} tabs={[{ value: 'events', label: 'События и безопасность' }, { value: 'admin', label: 'Действия администраторов' }]} />
      {kind === 'events' && (
        <div className="mb-4">
          <Filter ariaLabel="Уровень" value={level} onChange={(v) => { setLevel(v); setPage(1) }} options={['all', 'info', 'warn', 'error', 'security'].map((v) => ({ value: v, label: v }))} />
        </div>
      )}
      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <>
          <DataTable
            rows={data.items}
            columns={[
              { key: 'd', label: 'Время', render: (r) => <span className="text-muted whitespace-nowrap">{formatDate(r.createdAt)}</span> },
              ...(kind === 'events' ? [{ key: 'l', label: 'Уровень', render: (r: Row) => <Badge tone={r.level === 'error' ? 'danger' : r.level === 'security' ? 'warning' : 'neutral'}>{r.level}</Badge> }] : []),
              { key: 'e', label: kind === 'events' ? 'Событие' : 'Действие', render: (r) => <span className="font-mono text-xs">{r.event ?? r.action}</span> },
              { key: 'u', label: kind === 'events' ? 'Пользователь' : 'Админ', render: (r) => r.username ?? '—' },
              ...(kind === 'admin' ? [{ key: 't', label: 'Цель', render: (r: Row) => <span className="font-mono text-[11px] text-muted">{r.targetType}:{r.targetId?.slice(0, 12)}</span> }] : []),
              { key: 'ip', label: 'IP', render: (r) => <span className="text-xs text-muted">{r.ip ?? '—'}</span> },
              { key: 'x', label: 'Детали', className: 'max-w-[380px]', render: (r) => <code className="block truncate text-[11px] text-subtle" title={JSON.stringify(r.details)}>{r.details ? JSON.stringify(r.details) : ''}</code> },
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
