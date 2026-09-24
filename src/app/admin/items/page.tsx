'use client'

import { RefreshCw } from 'lucide-react'
import Image from 'next/image'
import { useState, type FormEvent } from 'react'
import { AdminTitle, DataTable, Field } from '@/components/admin/ui'
import { RarityBadge, rarityColor } from '@/components/domain/RarityBadge'
import { useSession } from '@/components/SessionProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Filter } from '@/components/ui/Filter'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { Search } from '@/components/ui/Search'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { t } from '@/i18n/ru'
import { api, ApiError, qs } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { RARITIES, type ItemDTO, type Paginated, type Rarity } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

type Row = ItemDTO & { isActive: boolean; marketHashName: string | null; marketPrice: string | null; priceSource: string | null; priceUpdatedAt: string | null; priceLocked: boolean }

export default function AdminItems() {
  const toast = useToast()
  const { user } = useSession()
  const [q, setQ] = useState('')
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const [page, setPage] = useState(1)
  const [edit, setEdit] = useState<Row | 'new' | null>(null)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState(false)
  const { data, error, reload } = useFetch<Paginated<Row>>(`/api/admin/items${qs({ q, page, pageSize: 25, rarity: rarity === 'all' ? undefined : rarity })}`)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const cur = edit === 'new' ? null : edit
    setErrs({})
    try {
      await api(cur ? `/api/admin/items/${cur.id}` : '/api/admin/items', {
        method: cur ? 'PUT' : 'POST',
        body: {
          name: fd.get('name'),
          image: fd.get('image'),
          price: Number(fd.get('price')),
          rarity: fd.get('rarity'),
          description: fd.get('description'),
          isActive: fd.get('isActive') === 'on',
          marketHashName: String(fd.get('marketHashName') || '') || null,
          priceLocked: fd.get('priceLocked') === 'on',
        },
      })
      toast.success('Предмет сохранён')
      setEdit(null)
      reload()
    } catch (err) {
      const ae = err as ApiError
      setErrs(ae.fields ?? {})
      toast.error('Ошибка', ae.message)
    }
  }

  async function sync(dryRun: boolean) {
    setSyncing(true)
    try {
      const r = await api<{ provider: string; total: number; updated: number; missing: number; changes: unknown[] }>('/api/admin/prices/sync', { body: { dryRun } })
      toast.success(dryRun ? 'Проверка цен (без сохранения)' : 'Цены обновлены', `${r.provider}: найдено ${r.updated}/${r.total}, изменится ${r.changes.length}`)
      if (!dryRun) reload()
    } catch (e) {
      toast.error('Синхронизация не выполнена', (e as ApiError).message)
    } finally {
      setSyncing(false)
    }
  }

  const cur = edit && edit !== 'new' ? edit : null
  return (
    <>
      <AdminTitle
        title="Предметы"
        description="Цены можно синхронизировать с маркетом по market_hash_name (провайдер и наценка — в Настройках)."
        actions={
          <>
            {user?.role === 'superadmin' && (
              <>
                <Button variant="secondary" loading={syncing} onClick={() => sync(true)}>
                  Проверить цены
                </Button>
                <Button variant="secondary" loading={syncing} onClick={() => sync(false)}>
                  <RefreshCw className="size-4" /> Синхронизировать цены
                </Button>
              </>
            )}
            <Button onClick={() => { setErrs({}); setEdit('new') }}>Добавить предмет</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Filter ariaLabel="Редкость" value={rarity} onChange={(v) => { setRarity(v); setPage(1) }} options={[{ value: 'all' as const, label: 'Все' }, ...RARITIES.map((r) => ({ value: r, label: t.rarity[r], color: rarityColor[r] }))]} />
        <Search value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Поиск" className="lg:w-64" />
      </div>
      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <>
          <DataTable
            rows={data.items}
            onRowClick={(r) => { setErrs({}); setEdit(r) }}
            columns={[
              { key: 'i', label: '', render: (r) => <Image src={r.image} alt="" width={48} height={34} className="h-7 w-auto" /> },
              { key: 'n', label: 'Название', render: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'r', label: 'Редкость', render: (r) => <RarityBadge rarity={r.rarity} /> },
              { key: 'p', label: 'Цена', render: (r) => <span className="tnum">{formatMoney(r.price)}</span> },
              { key: 'm', label: 'Маркет', render: (r) => (r.marketPrice ? <span className="text-xs text-muted tnum">{formatMoney(r.marketPrice)} · {r.priceSource}</span> : <span className="text-xs text-subtle">—</span>) },
              { key: 'u', label: 'Обновлено', render: (r) => <span className="text-xs text-muted">{r.priceUpdatedAt ? formatDate(r.priceUpdatedAt) : '—'}</span> },
              { key: 'a', label: 'Статус', render: (r) => <div className="flex gap-1">{r.isActive ? <Badge tone="success">active</Badge> : <Badge>off</Badge>}{r.priceLocked && <Badge tone="warning">lock</Badge>}</div> },
            ]}
          />
          <div className="mt-4">
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        </>
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={cur ? 'Редактировать предмет' : 'Новый предмет'} size="lg">
        <form key={cur?.id ?? 'new'} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Название" error={errs.name}>
            <input name="name" className="input h-10" defaultValue={cur?.name} required />
          </Field>
          <Field label="Цена, $" error={errs.price}>
            <input name="price" type="number" step="0.01" min="0.01" className="input h-10 tnum" defaultValue={cur?.price} required />
          </Field>
          <Field label="Редкость" error={errs.rarity}>
            <select name="rarity" className="input h-10" defaultValue={cur?.rarity ?? 'common'}>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {t.rarity[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Изображение" error={errs.image} hint="/assets/items/rifle.svg или https://… (только ресурсы с правами на использование)">
            <input name="image" className="input h-10" defaultValue={cur?.image ?? '/assets/items/rifle.svg'} required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="market_hash_name (для синхронизации цены)" error={errs.marketHashName} hint='Например: "AK-47 | Redline (Field-Tested)". Пусто — цена только вручную.'>
              <input name="marketHashName" className="input h-10" defaultValue={cur?.marketHashName ?? ''} maxLength={200} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Описание" error={errs.description}>
              <textarea name="description" className="input h-20 py-2" defaultValue={cur?.description} maxLength={1000} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="isActive" defaultChecked={cur?.isActive ?? true} className="size-4 accent-[#7C5CFF]" /> Активен
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="priceLocked" defaultChecked={cur?.priceLocked ?? false} className="size-4 accent-[#7C5CFF]" /> Зафиксировать цену (не синхронизировать)
          </label>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit">Сохранить</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
