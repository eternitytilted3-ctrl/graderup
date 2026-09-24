'use client'

import { CreditCard, ShieldCheck } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/domain/PageHeader'
import { useSession } from '@/components/SessionProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { t } from '@/i18n/ru'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'

interface Payment {
  id: string
  amount: string
  bonusAmount: string
  status: keyof typeof t.paymentStatus
  checkoutUrl: string | null
  createdAt: string
}

export function DepositView({ config, payments, bonusPercent, mock }: { config: { minAmount: number; maxAmount: number; presets: number[]; currency: string }; payments: Payment[]; bonusPercent: string; mock: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()
  const { refresh } = useSession()
  const [amount, setAmount] = useState(String(config.presets[1] ?? config.minAmount))
  const [loading, setLoading] = useState(false)

  // Returning from the provider: poll the payment status (the webhook is the source of truth).
  useEffect(() => {
    const id = params.get('payment')
    if (!id) return
    let n = 0
    const tick = async () => {
      try {
        const p = await api<Payment>(`/api/payments/${id}`)
        if (p.status === 'completed') {
          toast.success('Баланс пополнен', `+${formatMoney(p.amount)}`)
          await refresh()
          router.replace('/deposit')
          router.refresh()
          return
        }
        if (p.status !== 'pending') {
          toast.error('Платёж не завершён', t.paymentStatus[p.status])
          router.replace('/deposit')
          return
        }
      } catch {}
      if (++n < 10) setTimeout(tick, 2000)
    }
    void tick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const num = Number(amount)
  const valid = Number.isFinite(num) && num >= config.minAmount && num <= config.maxAmount

  async function submit() {
    setLoading(true)
    try {
      const p = await api<Payment>('/api/payments/create', { body: { amount: Math.round(num * 100) / 100 } })
      if (p.checkoutUrl) window.location.href = p.checkoutUrl
    } catch (err) {
      toast.error('Не удалось создать платёж', (err as ApiError).message)
      setLoading(false)
    }
  }

  return (
    <div className="container-page">
      <PageHeader title="Пополнение баланса" description="Баланс зачисляется только после подтверждения платежа платёжным провайдером." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card p-5 sm:p-6">
          <div className="label mb-3">Сумма, {config.currency}</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {config.presets.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(String(p))}
                className={cn('h-12 rounded-md border font-display font-bold tnum transition', Number(amount) === p ? 'border-primary bg-primary/15' : 'border-border hover:border-border-strong')}
              >
                ${p}
              </button>
            ))}
          </div>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-medium">Своя сумма</span>
            <input className="input tnum" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))} aria-describedby="amount-hint" />
            <span id="amount-hint" className={cn('mt-1 block text-xs', valid ? 'text-muted' : 'text-danger')}>
              От {formatMoney(config.minAmount)} до {formatMoney(config.maxAmount)}
            </span>
          </label>
          {Number(bonusPercent) > 0 && (
            <div className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              Активен бонус +{Number(bonusPercent)}% к этому пополнению{valid && ` (+${formatMoney((num * Number(bonusPercent)) / 100)})`}
            </div>
          )}
          <Button size="lg" className="mt-6 w-full" disabled={!valid} loading={loading} onClick={submit} data-testid="deposit-submit">
            <CreditCard className="size-4" /> Перейти к оплате {valid && formatMoney(num)}
          </Button>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-success" /> Мы не храним данные карт. Оплата проходит на стороне провайдера.
          </p>
          {mock && <p className="mt-2 text-xs text-warning">Режим разработки: используется тестовый (mock) платёжный провайдер.</p>}
        </section>
        <aside className="card p-5">
          <div className="mb-3 font-display font-semibold">Последние платежи</div>
          {payments.length === 0 ? (
            <p className="text-sm text-muted">Платежей пока нет.</p>
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <div className="font-semibold tnum">{formatMoney(p.amount)}</div>
                    <div className="text-xs text-muted">{formatDate(p.createdAt)}</div>
                  </div>
                  <Badge tone={p.status === 'completed' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'}>{t.paymentStatus[p.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
