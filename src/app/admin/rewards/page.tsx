'use client'

import type { FormEvent } from 'react'
import { AdminTitle, Field } from '@/components/admin/ui'
import { Button } from '@/components/ui/Button'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { useFetch } from '@/lib/useFetch'

interface Reward {
  id: string
  type: string
  title: string
  description: string
  amount: string
  cooldownSeconds: number
  minDepositTotal: string
  isActive: boolean
}

export default function AdminRewards() {
  const toast = useToast()
  const { data, error, reload } = useFetch<{ items: Reward[] }>('/api/admin/rewards')
  async function save(e: FormEvent<HTMLFormElement>, r: Reward) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await api(`/api/admin/rewards/${r.id}`, {
        method: 'PUT',
        body: {
          title: fd.get('title'),
          description: fd.get('description'),
          amount: Number(fd.get('amount')),
          cooldownSeconds: Number(fd.get('cooldownSeconds')),
          minDepositTotal: Number(fd.get('minDepositTotal')),
          isActive: fd.get('isActive') === 'on',
        },
      })
      toast.success('Награда сохранена')
      reload()
    } catch (err) {
      toast.error('Ошибка', (err as ApiError).message)
    }
  }
  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <LoadingState />
  return (
    <>
      <AdminTitle title="Награды" description="Daily/Weekly — фиксированные окна (UTC). Referral — за каждого приглашённого с депозитом." />
      <div className="grid gap-4 lg:grid-cols-3">
        {data.items.map((r) => (
          <form key={r.id} onSubmit={(e) => save(e, r)} className="card space-y-3 p-4">
            <div className="label">{r.type}</div>
            <Field label="Название">
              <input name="title" className="input h-10" defaultValue={r.title} required />
            </Field>
            <Field label="Описание">
              <textarea name="description" className="input h-16 py-2" defaultValue={r.description} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Сумма, $">
                <input name="amount" type="number" step="0.01" min="0" className="input h-10" defaultValue={r.amount} />
              </Field>
              <Field label="Период, сек">
                <input name="cooldownSeconds" type="number" min="0" className="input h-10" defaultValue={r.cooldownSeconds} disabled={r.type === 'referral'} />
              </Field>
            </div>
            <Field label="Мин. сумма депозитов, $" hint="Анти-абуз мультиаккаунтов">
              <input name="minDepositTotal" type="number" step="0.01" min="0" className="input h-10" defaultValue={r.minDepositTotal} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="isActive" defaultChecked={r.isActive} className="size-4 accent-[#7C5CFF]" /> Активна
            </label>
            {r.type === 'referral' && <input type="hidden" name="cooldownSeconds" value={0} />}
            <Button type="submit" size="sm">
              Сохранить
            </Button>
          </form>
        ))}
      </div>
    </>
  )
}
