'use client'

import { CalendarDays, CalendarRange, Copy, Gift, Ticket, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/domain/PageHeader'
import { useSession } from '@/components/SessionProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { countdown, formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { useFetch } from '@/lib/useFetch'

interface Reward {
  id: string
  type: 'daily' | 'weekly' | 'referral'
  title: string
  description: string
  amount: string
  claimable: boolean
  claimedThisPeriod?: boolean
  nextAt: string | null
  requirement: { minDepositTotal: string; deposited: string } | null
  pendingCount?: number
  claimableAmount?: string
  referredCount?: number
}
interface Resp {
  rewards: Reward[]
  history: { id: string; amount: string; createdAt: string; type: string; title: string }[]
  referralCode: string
}

const icons = { daily: CalendarDays, weekly: CalendarRange, referral: Users }

function Countdown({ to }: { to: string }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="tnum">{countdown(to)}</span>
}

export function RewardsView() {
  const { setBalance } = useSession()
  const toast = useToast()
  const { data, error, reload } = useFetch<Resp>('/api/rewards')
  const [claiming, setClaiming] = useState<string | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)

  async function claim(r: Reward) {
    setClaiming(r.id)
    try {
      const res = await api<{ amount: string; balance: string }>(`/api/rewards/${r.id}/claim`, { method: 'POST' })
      setBalance(res.balance)
      toast.success(`+${formatMoney(res.amount)}`, r.title)
      reload()
    } catch (err) {
      toast.error('Не удалось получить награду', (err as ApiError).message)
      reload()
    } finally {
      setClaiming(null)
    }
  }

  async function promo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const code = String(new FormData(form).get('code') ?? '').trim()
    if (!code) return
    setPromoLoading(true)
    try {
      const r = await api<{ type: string; amount?: string; balance?: string; percent?: string; item?: { name: string } }>('/api/rewards/promo', { body: { code } })
      if (r.balance) setBalance(r.balance)
      toast.success(
        'Промокод активирован',
        r.type === 'fixed' ? `+${formatMoney(r.amount!)} на баланс` : r.type === 'percentage' ? `+${Number(r.percent)}% к следующему пополнению` : `${r.item?.name} добавлен в инвентарь`,
      )
      form.reset()
      reload()
    } catch (err) {
      toast.error('Промокод не принят', (err as ApiError).message)
    } finally {
      setPromoLoading(false)
    }
  }

  const refLink = typeof window !== 'undefined' && data ? `${window.location.origin}/login?ref=${data.referralCode}` : ''

  return (
    <div className="container-page">
      <PageHeader eyebrow="Rewards" title="Награды" description="Бонусы начисляются на баланс. Каждую награду можно получить один раз за период." />
      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {data.rewards.map((r) => {
              const Icon = icons[r.type]
              return (
                <div key={r.id} className="card flex flex-col p-5" data-testid={`reward-${r.type}`}>
                  <div className="flex items-start justify-between">
                    <div className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                      <Icon className="size-5" />
                    </div>
                    {r.claimedThisPeriod ? <Badge tone="success">Получено</Badge> : r.claimable ? <Badge tone="accent">Доступно</Badge> : null}
                  </div>
                  <div className="mt-4 font-display text-lg font-semibold">{r.title}</div>
                  <p className="mt-1 text-sm text-muted">{r.description}</p>
                  <div className="mt-4 font-display text-2xl font-bold tnum">
                    {r.type === 'referral' ? `${formatMoney(r.amount)} / друг` : formatMoney(r.amount)}
                  </div>
                  <div className="mt-auto pt-5">
                    {r.type === 'referral' ? (
                      <>
                        <div className="mb-3 text-xs text-muted">
                          Приглашено: {r.referredCount} · к получению: {r.pendingCount} ({formatMoney(r.claimableAmount ?? 0)})
                        </div>
                        <Button className="w-full" disabled={!r.claimable} loading={claiming === r.id} onClick={() => claim(r)}>
                          {r.claimable ? `Забрать ${formatMoney(r.claimableAmount ?? 0)}` : 'Нет новых наград'}
                        </Button>
                      </>
                    ) : r.nextAt ? (
                      <Button className="w-full" variant="secondary" disabled>
                        Следующая через <Countdown to={r.nextAt} />
                      </Button>
                    ) : r.requirement ? (
                      <Button className="w-full" variant="secondary" disabled>
                        Пополните на {formatMoney(r.requirement.minDepositTotal)} (сейчас {formatMoney(r.requirement.deposited)})
                      </Button>
                    ) : (
                      <Button className="w-full" loading={claiming === r.id} onClick={() => claim(r)}>
                        <Gift className="size-4" /> Забрать
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <form onSubmit={promo} className="card p-5">
              <div className="flex items-center gap-2 font-display font-semibold">
                <Ticket className="size-4 text-accent" /> Промокод
              </div>
              <p className="mt-1 text-sm text-muted">Бонус на баланс, процент к пополнению или предмет.</p>
              <div className="mt-4 flex gap-2">
                <input name="code" className="input uppercase" placeholder="Введите код" maxLength={32} aria-label="Промокод" autoComplete="off" />
                <Button type="submit" loading={promoLoading}>
                  Активировать
                </Button>
              </div>
            </form>
            <div className="card p-5">
              <div className="flex items-center gap-2 font-display font-semibold">
                <Users className="size-4 text-accent" /> Реферальная ссылка
              </div>
              <p className="mt-1 text-sm text-muted">Друг получает бонус к первому пополнению, вы — награду после его депозита.</p>
              <div className="mt-4 flex gap-2">
                <input readOnly value={refLink} className="input text-xs" aria-label="Реферальная ссылка" onFocus={(e) => e.currentTarget.select()} />
                <Button
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(refLink)
                    toast.info('Ссылка скопирована')
                  }}
                  aria-label="Скопировать"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <section className="mt-10">
            <h2 className="mb-4 font-display text-lg font-bold">История наград</h2>
            {data.history.length === 0 ? (
              <p className="text-sm text-muted">Пока нет полученных наград.</p>
            ) : (
              <div className="card divide-y divide-border">
                {data.history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>{h.title}</span>
                    <span className="flex items-center gap-4">
                      <span className="text-xs text-muted">{formatDate(h.createdAt)}</span>
                      <span className="font-semibold text-success tnum">+{formatMoney(h.amount)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
