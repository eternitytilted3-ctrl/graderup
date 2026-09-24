'use client'

import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { use, useEffect, useMemo, useState } from 'react'
import { CaseForm, type CaseRecord } from '@/components/admin/CaseForm'
import { AdminTitle } from '@/components/admin/ui'
import { ItemCard } from '@/components/domain/ItemCard'
import { RarityBadge } from '@/components/domain/RarityBadge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Search } from '@/components/ui/Search'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, qs } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import type { ItemDTO, Paginated } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

interface EditData {
  case: CaseRecord
  items: { item: ItemDTO & { isActive: boolean }; dropWeight: number; dropChance: string }[]
}
interface Row {
  item: ItemDTO
  /** Editable chance in percent; converted to integer weights (×1000) on save. */
  chance: string
}

export default function CaseEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const toast = useToast()
  const { data, error, reload } = useFetch<EditData>(`/api/admin/cases/${id}`)
  const [rows, setRows] = useState<Row[]>([])
  const [dirty, setDirty] = useState(false)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)
  const [preview, setPreview] = useState(false)
  const catalog = useFetch<Paginated<ItemDTO>>(adding ? `/api/admin/items${qs({ q, pageSize: 30 })}` : null)

  useEffect(() => {
    if (!data) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(data.items.map((e) => ({ item: e.item, chance: Number(e.dropChance).toFixed(3) })))
    setDirty(false)
  }, [data])

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.chance) || 0), 0), [rows])
  const ev = useMemo(() => rows.reduce((s, r) => s + (Number(r.chance) / 100) * Number(r.item.price), 0), [rows])
  const price = Number(data?.case.price ?? 0)
  const rtp = price ? (ev / price) * 100 : 0
  const totalOk = Math.abs(total - 100) < 0.001
  const invalid = rows.some((r) => !(Number(r.chance) > 0))

  function update(i: number, chance: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, chance } : r)))
    setDirty(true)
  }
  function normalize() {
    if (total <= 0) return
    setRows((rs) => rs.map((r) => ({ ...r, chance: ((Number(r.chance) / total) * 100).toFixed(3) })))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      await api(`/api/admin/cases/${id}/items`, {
        method: 'PUT',
        body: { items: rows.map((r) => ({ itemId: r.item.id, dropWeight: Math.max(1, Math.round(Number(r.chance) * 1000)) })) },
      })
      toast.success('Состав кейса сохранён')
      reload()
    } catch (e) {
      toast.error('Ошибка', (e as ApiError).message)
    } finally {
      setSaving(false)
      setConfirmSave(false)
    }
  }

  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <LoadingState />

  return (
    <>
      <AdminTitle
        title={`Кейс: ${data.case.name}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPreview(true)}>
              Предпросмотр
            </Button>
            <Link href={`/cases/${data.case.slug}`} target="_blank">
              <Button variant="ghost">Открыть на сайте</Button>
            </Link>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <section className="card p-4">
          <div className="mb-3 flex items-center gap-3">
            <Image src={data.case.image} alt="" width={200} height={160} className="h-16 w-auto" />
            <div className="text-sm text-muted">Основные параметры</div>
          </div>
          <CaseForm initial={data.case} onSaved={() => reload()} />
        </section>
        <section>
          <div className="card mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
            <div>
              Total probability: <span className={`font-semibold tnum ${totalOk ? 'text-success' : 'text-danger'}`}>{total.toFixed(3)}%</span>
            </div>
            <div>
              EV: <span className="font-semibold tnum">{formatMoney(ev.toFixed(2))}</span>
            </div>
            <div>
              RTP: <span className={`font-semibold tnum ${rtp > 100 ? 'text-danger' : ''}`}>{rtp.toFixed(1)}%</span>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={normalize} disabled={totalOk}>
                Нормализовать до 100%
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                <Plus className="size-3.5" /> Добавить предмет
              </Button>
              <Button size="sm" onClick={() => (totalOk ? save() : setConfirmSave(true))} disabled={!dirty || invalid} loading={saving}>
                Сохранить состав
              </Button>
            </div>
          </div>
          {!totalOk && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning" role="alert">
              <AlertTriangle className="size-4 shrink-0" /> Сумма вероятностей {total.toFixed(3)}% ≠ 100%. При сохранении шансы будут пропорционально нормализованы сервером.
            </div>
          )}
          {rtp > 100 && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="size-4 shrink-0" /> RTP выше 100%: ожидаемая стоимость дропа больше цены кейса.
            </div>
          )}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Предмет</th>
                  <th className="px-3 py-2 text-left font-medium">Редкость</th>
                  <th className="px-3 py-2 text-left font-medium">Цена</th>
                  <th className="px-3 py-2 text-left font-medium">Шанс, %</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr key={r.item.id}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Image src={r.item.image} alt="" width={40} height={28} className="h-6 w-auto" />
                        {r.item.name}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <RarityBadge rarity={r.item.rarity} />
                    </td>
                    <td className="px-3 py-2 tnum">{formatMoney(r.item.price)}</td>
                    <td className="px-3 py-2">
                      <input className={`input h-8 w-28 tnum ${Number(r.chance) > 0 ? '' : 'border-danger'}`} inputMode="decimal" value={r.chance} onChange={(e) => update(i, e.target.value.replace(',', '.'))} aria-label={`Шанс ${r.item.name}`} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="rounded p-1.5 text-subtle hover:bg-danger/10 hover:text-danger" onClick={() => { setRows((rs) => rs.filter((_, j) => j !== i)); setDirty(true) }} aria-label="Удалить">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted">
                      В кейсе нет предметов — он не может быть открыт.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Добавить предмет" size="lg">
        <Search value={q} onChange={setQ} placeholder="Поиск по названию" />
        <div className="mt-3 max-h-[50vh] divide-y divide-border overflow-y-auto">
          {catalog.data?.items
            .filter((i) => !rows.some((r) => r.item.id === i.id))
            .map((i) => (
              <button key={i.id} className="flex w-full items-center gap-3 px-2 py-2 text-left text-sm hover:bg-white/[0.03]" onClick={() => { setRows((rs) => [...rs, { item: i, chance: '1.000' }]); setDirty(true) }}>
                <Image src={i.image} alt="" width={40} height={28} className="h-6 w-auto" />
                <span className="flex-1">{i.name}</span>
                <RarityBadge rarity={i.rarity} />
                <span className="w-20 text-right tnum">{formatMoney(i.price)}</span>
              </button>
            ))}
        </div>
      </Modal>

      <ConfirmModal open={confirmSave} title="Сумма вероятностей ≠ 100%" confirmLabel="Сохранить с нормализацией" loading={saving} onClose={() => setConfirmSave(false)} onConfirm={save}>
        Текущая сумма {total.toFixed(3)}%. Сервер хранит целочисленные веса, итоговые шансы будут пересчитаны пропорционально (сумма = 100%).
      </ConfirmModal>

      <Modal open={preview} onClose={() => setPreview(false)} title="Предпросмотр состава" size="lg">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {rows.map((r) => (
            <ItemCard key={r.item.id} item={r.item} size="sm" chance={total > 0 ? ((Number(r.chance) / total) * 100).toFixed(4) : '0'} />
          ))}
        </div>
      </Modal>
    </>
  )
}
