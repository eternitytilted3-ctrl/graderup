'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AdminTitle, DataTable } from '@/components/admin/ui'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { useFetch } from '@/lib/useFetch'

interface Row {
  id: string
  userId: string
  username: string
  status: 'searching' | 'waiting_accept' | 'completed' | 'failed' | 'cancelled'
  message: string | null
  provider: string
  price: string
  itemName: string
  createdAt: string
}
const LABEL: Record<Row['status'], string> = { searching: 'Поиск продавца', waiting_accept: 'Ждёт принятия', completed: 'Выведено', failed: 'Ошибка', cancelled: 'Отменено' }

export default function AdminSkinWithdrawals() {
  const toast = useToast()
  const { data, error, reload } = useFetch<{ config: { enabled: boolean; available: boolean; provider: string | null; maxActive: number }; items: Row[] }>('/api/admin/skin-withdrawals')
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (!data) return
    setBusy(true)
    try {
      await api('/api/admin/skin-withdrawals/toggle', { body: { enabled: !data.config.enabled } })
      toast.success(data.config.enabled ? 'Вывод скинов закрыт' : 'Вывод скинов открыт')
      reload()
    } catch (e) {
      toast.error('Ошибка', (e as ApiError).message)
    } finally {
      setBusy(false)
    }
  }
  async function cancel(id: string) {
    try {
      await api(`/api/admin/skin-withdrawals/${id}/cancel`, { method: 'POST' })
      toast.success('Вывод отменён, предмет возвращён')
      reload()
    } catch (e) {
      toast.error('Ошибка', (e as ApiError).message)
    }
  }

  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <LoadingState />
  return (
    <>
      <AdminTitle
        title="Вывод скинов в Steam"
        description={`Провайдер трейдов: ${data.config.provider ?? 'не настроен (TRADE_PROVIDER)'}${data.config.provider === 'mock' ? ' — симуляция для разработки' : ''}. Лимит активных на игрока: ${data.config.maxActive}.`}
        actions={
          <>
            <Button variant={data.config.enabled ? 'danger' : 'success'} onClick={toggle} loading={busy}>
              {data.config.enabled ? 'Закрыть вывод скинов' : 'Открыть вывод скинов'}
            </Button>
            <Badge tone={data.config.available ? 'success' : 'danger'}>{data.config.available ? 'Работает' : 'Недоступен'}</Badge>
          </>
        }
      />
      <DataTable
        rows={data.items}
        columns={[
          { key: 'd', label: 'Дата', render: (r) => <span className="text-muted whitespace-nowrap">{formatDate(r.createdAt)}</span> },
          { key: 'u', label: 'Игрок', render: (r) => <Link className="text-accent hover:underline" href={`/admin/users/${r.userId}`}>{r.username}</Link> },
          { key: 'i', label: 'Скин', render: (r) => r.itemName },
          { key: 'p', label: 'Цена', render: (r) => <span className="tnum">{formatMoney(r.price)}</span> },
          { key: 's', label: 'Статус', render: (r) => <Badge tone={r.status === 'completed' ? 'success' : r.status === 'failed' || r.status === 'cancelled' ? 'danger' : 'warning'}>{LABEL[r.status]}</Badge> },
          { key: 'pr', label: 'Провайдер', render: (r) => <span className="text-muted">{r.provider}</span> },
          {
            key: 'x',
            label: '',
            render: (r) =>
              r.status === 'searching' || r.status === 'waiting_accept' ? (
                <Button size="sm" variant="secondary" onClick={() => cancel(r.id)}>
                  Отменить
                </Button>
              ) : null,
          },
        ]}
      />
    </>
  )
}
