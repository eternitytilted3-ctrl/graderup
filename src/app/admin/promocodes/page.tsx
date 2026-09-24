'use client'

import { useState, type FormEvent } from 'react'
import { AdminTitle, DataTable, Field } from '@/components/admin/ui'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { useFetch } from '@/lib/useFetch'

interface Promo {
  id: string
  code: string
  type: 'fixed' | 'percentage' | 'item'
  value: string
  itemId: string | null
  itemName: string | null
  maxUses: number
  usedCount: number
  expiresAt: string | null
  active: boolean
}

export default function AdminPromocodes() {
  const toast = useToast()
  const { data, error, reload } = useFetch<{ items: Promo[] }>('/api/admin/promocodes')
  const [edit, setEdit] = useState<Promo | 'new' | null>(null)
  const [type, setType] = useState<Promo['type']>('fixed')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const cur = edit && edit !== 'new' ? edit : null

  function open(p: Promo | 'new') {
    setErrs({})
    setType(p === 'new' ? 'fixed' : p.type)
    setEdit(p)
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const exp = String(fd.get('expiresAt') || '')
    try {
      await api(cur ? `/api/admin/promocodes/${cur.id}` : '/api/admin/promocodes', {
        method: cur ? 'PUT' : 'POST',
        body: {
          code: fd.get('code'),
          type,
          value: Number(fd.get('value') || 0),
          itemId: type === 'item' ? fd.get('itemId') : null,
          maxUses: Number(fd.get('maxUses')),
          expiresAt: exp ? new Date(exp).toISOString() : null,
          active: fd.get('active') === 'on',
        },
      })
      toast.success('Промокод сохранён')
      setEdit(null)
      reload()
    } catch (err) {
      const ae = err as ApiError
      setErrs(ae.fields ?? {})
      toast.error('Ошибка', ae.message)
    }
  }
  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <LoadingState />
  return (
    <>
      <AdminTitle title="Промокоды" actions={<Button onClick={() => open('new')}>Создать</Button>} />
      <DataTable
        rows={data.items}
        onRowClick={open}
        columns={[
          { key: 'c', label: 'Код', render: (r) => <span className="font-mono font-semibold">{r.code}</span> },
          { key: 't', label: 'Тип', render: (r) => r.type },
          { key: 'v', label: 'Значение', render: (r) => (r.type === 'fixed' ? `$${r.value}` : r.type === 'percentage' ? `${Number(r.value)}%` : r.itemName) },
          { key: 'u', label: 'Использовано', render: (r) => <span className="tnum">{r.usedCount} / {r.maxUses}</span> },
          { key: 'e', label: 'Истекает', render: (r) => <span className="text-muted">{r.expiresAt ? formatDate(r.expiresAt) : '—'}</span> },
          { key: 'a', label: 'Статус', render: (r) => (r.expiresAt && new Date(r.expiresAt) < new Date() ? <Badge tone="warning">истёк</Badge> : r.active ? <Badge tone="success">active</Badge> : <Badge>off</Badge>) },
        ]}
      />
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={cur ? `Промокод ${cur.code}` : 'Новый промокод'}>
        <form key={cur?.id ?? 'new'} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Код" error={errs.code}>
            <input name="code" className="input h-10 uppercase" defaultValue={cur?.code} required pattern="[A-Za-z0-9_\-]{3,32}" />
          </Field>
          <Field label="Тип">
            <select className="input h-10" value={type} onChange={(e) => setType(e.target.value as Promo['type'])}>
              <option value="fixed">fixed — сумма на баланс</option>
              <option value="percentage">percentage — % к депозиту</option>
              <option value="item">item — предмет</option>
            </select>
          </Field>
          {type === 'item' ? (
            <Field label="ID предмета" error={errs.itemId} hint="UUID из раздела «Предметы»">
              <input name="itemId" className="input h-10 font-mono text-xs" defaultValue={cur?.itemId ?? ''} required />
            </Field>
          ) : (
            <Field label={type === 'fixed' ? 'Сумма, $' : 'Процент'} error={errs.value}>
              <input name="value" type="number" step="0.01" min="0.01" className="input h-10" defaultValue={cur?.value} required />
            </Field>
          )}
          <Field label="Макс. активаций" error={errs.maxUses}>
            <input name="maxUses" type="number" min="1" className="input h-10" defaultValue={cur?.maxUses ?? 100} required />
          </Field>
          <Field label="Истекает" error={errs.expiresAt}>
            <input name="expiresAt" type="datetime-local" className="input h-10" defaultValue={cur?.expiresAt ? cur.expiresAt.slice(0, 16) : ''} />
          </Field>
          <label className="flex items-center gap-2 self-end text-sm text-muted">
            <input type="checkbox" name="active" defaultChecked={cur?.active ?? true} className="size-4 accent-[#7C5CFF]" /> Активен
          </label>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit">Сохранить</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
