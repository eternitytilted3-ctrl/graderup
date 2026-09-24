'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AdminTitle, DataTable } from '@/components/admin/ui'
import { CaseForm } from '@/components/admin/CaseForm'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { formatMoney } from '@/lib/money'
import type { CaseDTO } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

export default function AdminCases() {
  const router = useRouter()
  const { data, error, reload } = useFetch<{ items: CaseDTO[] }>('/api/admin/cases')
  const [creating, setCreating] = useState(false)
  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <LoadingState />
  return (
    <>
      <AdminTitle title="Кейсы" actions={<Button onClick={() => setCreating(true)}>Создать кейс</Button>} />
      <DataTable
        rows={data.items}
        onRowClick={(r) => router.push(`/admin/cases/${r.id}`)}
        columns={[
          { key: 'i', label: '', render: (r) => <Image src={r.image} alt="" width={48} height={36} className="h-8 w-auto" /> },
          { key: 'n', label: 'Название', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 's', label: 'Slug', render: (r) => <span className="text-muted">{r.slug}</span> },
          { key: 'p', label: 'Цена', render: (r) => <span className="tnum">{formatMoney(r.price)}</span> },
          { key: 'c', label: 'Предметов', render: (r) => r.itemCount },
          { key: 'st', label: 'Статус', render: (r) => (r.status === 'active' ? <Badge tone="success">active</Badge> : <Badge>disabled</Badge>) },
        ]}
      />
      <Modal open={creating} onClose={() => setCreating(false)} title="Новый кейс">
        <CaseForm onSaved={(c) => router.push(`/admin/cases/${c.id}`)} />
      </Modal>
    </>
  )
}
