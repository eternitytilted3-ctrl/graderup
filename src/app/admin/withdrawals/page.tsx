'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AdminTitle, DataTable } from '@/components/admin/ui'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Filter } from '@/components/ui/Filter'
import { Pagination } from '@/components/ui/Pagination'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { t } from '@/i18n/ru'
import { api, ApiError, qs } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { Paginated } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

interface Row {
  id: string
  userId: string
  username: string
  kycStatus: string
  amount: string
  method: string
  destination: string
  status: keyof typeof t.withdrawalStatus
  createdAt: string
  adminNote: string | null
}

export default function AdminWithdrawals() {
  const toast = useToast()
  const [status, setStatus] = useState<string>('pending')
  const [page, setPage] = useState(1)
  const [act, setAct] = useState<{ row: Row; action: 'approve' | 'reject' } | null>(null)
  const [busy, setBusy] = useState(false)
  const { data, error, reload } = useFetch<Paginated<Row>>(`/api/admin/withdrawals${qs({ page, pageSize: 25, status: status === 'all' ? undefined : status })}`)

  async function run() {
    if (!act) return
    setBusy(true)
    try {
      const note = (document.getElementById('wd-note') as HTMLInputElement)?.value || undefined
      await api(`/api/admin/withdrawals/${act.row.id}`, { body: { action: act.action, note } })
      toast.success(act.action === 'approve' ? 'Заявка одобрена' : 'Заявка отклонена, средства возвращены')
      reload()
    } catch (e) {
      toast.error('Ошибка', (e as ApiError).message)
    } finally {
      setBusy(false)
      setAct(null)
    }
  }

  return (
    <>
      <AdminTitle title="Выводы" description="Выплата выполняется вне системы; «Одобрить» фиксирует выплату, «Отклонить» возвращает средства (refund)." />
      <div className="mb-4">
        <Filter ariaLabel="Статус" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ value: 'all', label: 'Все' }, ...Object.entries(t.withdrawalStatus).map(([value, label]) => ({ value, label }))]} />
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
              { key: 'm', label: 'Способ / реквизиты', render: (r) => <span className="text-xs">{r.method} · <span className="font-mono">{r.destination}</span></span> },
              { key: 'k', label: 'KYC', render: (r) => r.kycStatus },
              { key: 's', label: 'Статус', render: (r) => <Badge tone={r.status === 'completed' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>{t.withdrawalStatus[r.status]}</Badge> },
              {
                key: 'x',
                label: '',
                render: (r) =>
                  r.status === 'pending' ? (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="success" onClick={() => setAct({ row: r, action: 'approve' })}>
                        Одобрить
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setAct({ row: r, action: 'reject' })}>
                        Отклонить
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">{r.adminNote}</span>
                  ),
              },
            ]}
          />
          <div className="mt-4">
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        </>
      )}
      <ConfirmModal
        open={Boolean(act)}
        title={act?.action === 'approve' ? 'Одобрить вывод?' : 'Отклонить вывод?'}
        variant={act?.action === 'reject' ? 'danger' : 'primary'}
        loading={busy}
        onClose={() => setAct(null)}
        onConfirm={run}
      >
        {act && `${act.row.username}: ${formatMoney(act.row.amount)}`}
        <input id="wd-note" className="input mt-3 h-10" placeholder="Комментарий (необязательно)" maxLength={500} />
      </ConfirmModal>
    </>
  )
}
