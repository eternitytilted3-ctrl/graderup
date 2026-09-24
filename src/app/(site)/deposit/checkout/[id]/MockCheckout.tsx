'use client'

import { FlaskConical } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { formatMoney } from '@/lib/money'

export function MockCheckout({ payment }: { payment: { id: string; amount: string; currency: string; status: string } }) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  async function act(outcome: 'completed' | 'cancelled') {
    setLoading(outcome)
    try {
      await api(`/api/payments/mock/${payment.id}`, { body: { outcome } })
      router.push(`/deposit?payment=${payment.id}`)
    } catch (err) {
      toast.error('Ошибка', (err as ApiError).message)
      setLoading(null)
    }
  }
  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-md p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-warning/10 text-warning">
          <FlaskConical className="size-6" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold">Тестовый платёжный провайдер</h1>
        <p className="mt-2 text-sm text-muted">Эта страница имитирует страницу оплаты внешнего провайдера. Реальные деньги не списываются.</p>
        <div className="mt-6 font-display text-3xl font-bold tnum">{formatMoney(payment.amount)}</div>
        <div className="text-xs text-muted">Платёж {payment.id.slice(0, 8)} · {payment.status}</div>
        <div className="mt-6 grid gap-2">
          <Button size="lg" onClick={() => act('completed')} loading={loading === 'completed'} disabled={payment.status !== 'pending'} data-testid="mock-pay">
            Оплатить (успех)
          </Button>
          <Button variant="secondary" onClick={() => act('cancelled')} loading={loading === 'cancelled'} disabled={payment.status !== 'pending'}>
            Отменить
          </Button>
        </div>
      </div>
    </div>
  )
}
