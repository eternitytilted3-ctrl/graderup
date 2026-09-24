'use client'

import Link from 'next/link'
import { AdminTitle, DataTable } from '@/components/admin/ui'
import { Badge } from '@/components/ui/Badge'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { formatDate } from '@/lib/format'
import type { PublicUserDTO } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

export default function AdminAdmins() {
  const { data, error, reload } = useFetch<{ items: (PublicUserDTO & { lastLoginAt: string | null })[] }>('/api/admin/admins')
  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <LoadingState />
  return (
    <>
      <AdminTitle title="Администраторы" description="Назначить или снять роль можно на странице пользователя (только superadmin). Первого superadmin создаёт `npm run admin:create`." />
      <DataTable
        rows={data.items}
        columns={[
          { key: 'u', label: 'Пользователь', render: (r) => <Link className="text-accent hover:underline" href={`/admin/users/${r.id}`}>{r.username}</Link> },
          { key: 'e', label: 'Email', render: (r) => r.email ?? '—' },
          { key: 'r', label: 'Роль', render: (r) => <Badge tone="primary">{r.role}</Badge> },
          { key: 'l', label: 'Последний вход', render: (r) => <span className="text-muted">{r.lastLoginAt ? formatDate(r.lastLoginAt) : '—'}</span> },
        ]}
      />
    </>
  )
}
