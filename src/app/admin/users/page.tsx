'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AdminTitle, DataTable } from '@/components/admin/ui'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { Search } from '@/components/ui/Search'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { qs } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { Paginated, PublicUserDTO } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

type Row = PublicUserDTO & { isBanned: boolean; lastLoginAt: string | null }

export default function AdminUsers() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, error, reload } = useFetch<Paginated<Row>>(`/api/admin/users${qs({ q, page, pageSize: 25 })}`)
  return (
    <>
      <AdminTitle title="Пользователи" actions={<Search value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="username, email или ID" className="w-72" />} />
      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <>
          <DataTable
            rows={data.items}
            onRowClick={(r) => router.push(`/admin/users/${r.id}`)}
            columns={[
              { key: 'u', label: 'Пользователь', render: (r) => <span className="font-medium">{r.username}</span> },
              { key: 'e', label: 'Email', render: (r) => <span className="text-muted">{r.email ?? '—'}</span> },
              { key: 'b', label: 'Баланс', render: (r) => <span className="tnum">{formatMoney(r.balance)}</span> },
              { key: 'r', label: 'Роль', render: (r) => (r.role === 'user' ? <span className="text-muted">user</span> : <Badge tone="primary">{r.role}</Badge>) },
              { key: 's', label: 'Статус', render: (r) => (r.isBanned ? <Badge tone="danger">Бан</Badge> : <Badge tone="success">Активен</Badge>) },
              { key: 'c', label: 'Регистрация', render: (r) => <span className="text-muted">{formatDate(r.createdAt)}</span> },
              { key: 'l', label: 'Последний вход', render: (r) => <span className="text-muted">{r.lastLoginAt ? formatDate(r.lastLoginAt) : '—'}</span> },
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
