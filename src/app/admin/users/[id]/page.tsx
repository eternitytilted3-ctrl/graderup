'use client'

import { use, useState, type FormEvent } from 'react'
import { AdminTitle, DataTable, Field, Stat } from '@/components/admin/ui'
import { RarityBadge } from '@/components/domain/RarityBadge'
import { useSession } from '@/components/SessionProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { t } from '@/i18n/ru'
import { api, ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { ItemDTO } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

interface Detail {
  user: { id: string; username: string; email: string | null; role: string; balance: string; isBanned: boolean; banReason: string | null; kycStatus: string; createdAt: string; lastLoginAt: string | null }
  stats: { casesOpened: number; upgrades: number; deposited: string }
  inventory: { id: string; status: keyof typeof t.itemStatus; source: string; createdAt: string; item: ItemDTO }[]
  transactions: { id: string; type: keyof typeof t.txType; amount: string; balanceBefore: string; balanceAfter: string; status: string; createdAt: string; meta: Record<string, unknown> | null }[]
}

export default function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user: me } = useSession()
  const toast = useToast()
  const { data, error, reload } = useFetch<Detail>(`/api/admin/users/${id}`)
  const [tab, setTab] = useState<'tx' | 'inv'>('tx')
  const [banOpen, setBanOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [adjErr, setAdjErr] = useState<Record<string, string>>({})

  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <LoadingState />
  const u = data.user

  async function toggleBan(reason?: string) {
    setBusy(true)
    try {
      await api(`/api/admin/users/${id}/ban`, { body: { banned: !u.isBanned, reason } })
      toast.success(u.isBanned ? 'Пользователь разблокирован' : 'Пользователь заблокирован')
      reload()
    } catch (e) {
      toast.error('Ошибка', (e as ApiError).message)
    } finally {
      setBusy(false)
      setBanOpen(false)
    }
  }

  async function adjust(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setAdjErr({})
    try {
      const r = await api<{ balance: string }>(`/api/admin/users/${id}/balance`, { body: { amount: String(fd.get('amount')).replace(',', '.'), reason: fd.get('reason') } })
      toast.success('Баланс изменён', `Новый баланс ${formatMoney(r.balance)}`)
      form.reset()
      reload()
    } catch (err) {
      const ae = err as ApiError
      setAdjErr(ae.fields ?? {})
      toast.error('Ошибка', ae.message)
    }
  }

  async function setRole(role: string) {
    try {
      await api(`/api/admin/users/${id}/role`, { body: { role } })
      toast.success('Роль обновлена')
      reload()
    } catch (e) {
      toast.error('Ошибка', (e as ApiError).message)
    }
  }

  return (
    <>
      <AdminTitle
        title={u.username}
        description={`${u.email ?? 'Steam'} · ID ${u.id}`}
        actions={
          <>
            {u.isBanned ? <Badge tone="danger">Бан{u.banReason ? `: ${u.banReason}` : ''}</Badge> : <Badge tone="success">Активен</Badge>}
            <Button variant={u.isBanned ? 'secondary' : 'danger'} size="sm" onClick={() => (u.isBanned ? toggleBan() : setBanOpen(true))} loading={busy} disabled={me?.id === u.id}>
              {u.isBanned ? 'Разблокировать' : 'Заблокировать'}
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Баланс" value={formatMoney(u.balance)} />
        <Stat label="Пополнено" value={formatMoney(data.stats.deposited)} />
        <Stat label="Кейсов" value={data.stats.casesOpened} />
        <Stat label="Апгрейдов" value={data.stats.upgrades} />
        <Stat label="KYC" value={u.kycStatus} sub={`Рег. ${formatDate(u.createdAt, false)}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <form onSubmit={adjust} className="card space-y-3 p-4">
          <div className="text-sm font-semibold">Корректировка баланса</div>
          <p className="text-xs text-muted">Создаёт транзакцию admin_adjustment и запись в журнале администратора.</p>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field label="Сумма (±)" error={adjErr.amount}>
              <input name="amount" className="input h-10 tnum" placeholder="10.00 / -5.00" required />
            </Field>
            <Field label="Причина" error={adjErr.reason}>
              <input name="reason" className="input h-10" placeholder="Компенсация за …" required minLength={3} />
            </Field>
          </div>
          <Button type="submit" size="sm">
            Применить
          </Button>
        </form>
        <div className="card space-y-3 p-4">
          <div className="text-sm font-semibold">Роль</div>
          <p className="text-xs text-muted">Изменять роли может только superadmin.</p>
          <div className="flex gap-2">
            {['user', 'admin', 'superadmin'].map((r) => (
              <Button key={r} size="sm" variant={u.role === r ? 'primary' : 'secondary'} disabled={me?.role !== 'superadmin' || me?.id === u.id} onClick={() => setRole(r)}>
                {r}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Tabs
        className="mt-6 mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'tx', label: 'Транзакции', count: data.transactions.length },
          { value: 'inv', label: 'Инвентарь', count: data.inventory.length },
        ]}
      />
      {tab === 'tx' ? (
        <DataTable
          rows={data.transactions}
          columns={[
            { key: 'd', label: 'Дата', render: (r) => <span className="text-muted">{formatDate(r.createdAt)}</span> },
            { key: 't', label: 'Тип', render: (r) => t.txType[r.type] },
            { key: 'a', label: 'Сумма', render: (r) => <span className={Number(r.amount) > 0 ? 'text-success tnum' : 'tnum'}>{r.amount}</span> },
            { key: 'b', label: 'До → После', render: (r) => <span className="text-muted tnum">{r.balanceBefore} → {r.balanceAfter}</span> },
            { key: 'm', label: 'Детали', render: (r) => <span className="text-xs text-muted">{String(r.meta?.itemName ?? r.meta?.reason ?? r.meta?.caseName ?? '')}</span> },
          ]}
        />
      ) : (
        <DataTable
          rows={data.inventory}
          columns={[
            { key: 'n', label: 'Предмет', render: (r) => r.item.name },
            { key: 'r', label: 'Редкость', render: (r) => <RarityBadge rarity={r.item.rarity} /> },
            { key: 'p', label: 'Цена', render: (r) => <span className="tnum">{formatMoney(r.item.price)}</span> },
            { key: 's', label: 'Статус', render: (r) => t.itemStatus[r.status] },
            { key: 'src', label: 'Источник', render: (r) => r.source },
            { key: 'd', label: 'Получен', render: (r) => <span className="text-muted">{formatDate(r.createdAt)}</span> },
          ]}
        />
      )}

      <ConfirmModal open={banOpen} title="Заблокировать пользователя?" variant="danger" confirmLabel="Заблокировать" loading={busy} onClose={() => setBanOpen(false)} onConfirm={() => toggleBan((document.getElementById('ban-reason') as HTMLInputElement)?.value || undefined)}>
        Все активные сессии будут завершены.
        <input id="ban-reason" className="input mt-3 h-10" placeholder="Причина (необязательно)" maxLength={500} />
      </ConfirmModal>
    </>
  )
}
