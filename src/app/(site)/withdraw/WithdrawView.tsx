'use client'

import { useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/domain/PageHeader'
import { useSession } from '@/components/SessionProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { t } from '@/i18n/ru'
import { api, ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { useFetch } from '@/lib/useFetch'

interface Resp {
  config: { enabled: boolean; minAmount: number; maxAmount: number; methods: string[]; kycThreshold: number }
  items: { id: string; amount: string; method: string; destination: string; status: keyof typeof t.withdrawalStatus; createdAt: string }[]
  kycStatus: string
}
const methodLabel: Record<string, string> = { card: 'Банковская карта', crypto_usdt: 'USDT (TRC-20)' }

export function WithdrawView() {
  const { user, setBalance } = useSession()
  const toast = useToast()
  const { data, error, reload } = useFetch<Resp>('/api/withdraw')
  const [loading, setLoading] = useState(false)
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({})

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setLoading(true)
    setFieldErr({})
    try {
      const r = await api<{ balance: string }>('/api/withdraw', { body: { amount: Number(fd.get('amount')), method: fd.get('method'), destination: fd.get('destination') } })
      setBalance(r.balance)
      toast.success('Заявка создана', 'Средства зарезервированы до обработки заявки')
      form.reset()
      reload()
    } catch (err) {
      const ae = err as ApiError
      if (ae.fields) setFieldErr(ae.fields)
      toast.error('Заявка не создана', ae.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-page">
      <PageHeader title="Вывод средств" description="Заявки обрабатываются вручную. Сумма резервируется сразу и возвращается при отклонении." />
      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-80" />
      ) : !data.config.enabled ? (
        <div className="card p-6 text-sm text-muted">Вывод средств временно недоступен.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
            <div className="text-sm text-muted">
              Доступно: <span className="font-semibold text-text tnum">{formatMoney(user?.balance ?? 0)}</span>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Сумма</span>
              <input name="amount" type="number" step="0.01" min={data.config.minAmount} max={data.config.maxAmount} className="input tnum" required />
              <span className="mt-1 block text-xs text-muted">
                От {formatMoney(data.config.minAmount)} до {formatMoney(data.config.maxAmount)}. Свыше {formatMoney(data.config.kycThreshold)} требуется верификация (KYC).
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Способ</span>
              <select name="method" className="input">
                {data.config.methods.map((m) => (
                  <option key={m} value={m}>
                    {methodLabel[m] ?? m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Реквизиты</span>
              <input name="destination" className="input" placeholder="Номер карты или адрес кошелька" required minLength={6} maxLength={128} autoComplete="off" />
              {fieldErr.destination && <span className="mt-1 block text-xs text-danger">{fieldErr.destination}</span>}
            </label>
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Создать заявку
            </Button>
            <p className="text-xs text-muted">KYC-статус: {data.kycStatus === 'verified' ? 'подтверждён' : 'не пройден'}</p>
          </form>
          <aside className="card p-5">
            <div className="mb-3 font-display font-semibold">Мои заявки</div>
            {data.items.length === 0 ? (
              <p className="text-sm text-muted">Заявок пока нет.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.items.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <div className="font-semibold tnum">{formatMoney(w.amount)}</div>
                      <div className="text-xs text-muted">
                        {methodLabel[w.method] ?? w.method} · {w.destination} · {formatDate(w.createdAt)}
                      </div>
                    </div>
                    <Badge tone={w.status === 'completed' ? 'success' : w.status === 'rejected' ? 'danger' : 'warning'}>{t.withdrawalStatus[w.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
