'use client'

import { CheckSquare, Coins, Package, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { InventoryCard } from '@/components/domain/InventoryCard'
import { SkinWithdrawModal } from '@/components/domain/SkinWithdrawModal'
import { PageHeader } from '@/components/domain/PageHeader'
import { RarityBadge, rarityColor } from '@/components/domain/RarityBadge'
import { useSession } from '@/components/SessionProvider'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Filter } from '@/components/ui/Filter'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { Search } from '@/components/ui/Search'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { t } from '@/i18n/ru'
import { api, ApiError, qs } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { D, formatMoney } from '@/lib/money'
import { RARITIES, type InventoryItemDTO, type Paginated, type Rarity } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

type Entry = InventoryItemDTO & { sellPrice: string }
type Resp = Paginated<Entry> & { totalValue: string; sellRatio: number }

const SORTS = [
  { value: 'date_desc', label: 'Сначала новые' },
  { value: 'date_asc', label: 'Сначала старые' },
  { value: 'price_desc', label: 'Дороже' },
  { value: 'price_asc', label: 'Дешевле' },
  { value: 'rarity_desc', label: 'Редкость ↓' },
  { value: 'rarity_asc', label: 'Редкость ↑' },
]

export function InventoryView() {
  const { setBalance } = useSession()
  const toast = useToast()
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const [sort, setSort] = useState('date_desc')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<Entry | null>(null)
  const [confirm, setConfirm] = useState<{ ids: string[] | 'all'; amount: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [withdrawing, setWithdrawing] = useState<Entry | null>(null)

  const url = `/api/inventory${qs({ page, pageSize: 24, sort, rarity: rarity === 'all' ? undefined : rarity, search })}`
  const { data, error, loading, reload } = useFetch<Resp>(url)

  const selectedEntries = useMemo(() => data?.items.filter((i) => selected.has(i.id)) ?? [], [data, selected])
  const selectedSum = selectedEntries.reduce((s, e) => s.plus(e.sellPrice), D(0)).toFixed(2)

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function doSell() {
    if (!confirm) return
    setBusy(true)
    try {
      const r =
        confirm.ids === 'all'
          ? await api<{ balance: string; amount: string; soldCount: number }>('/api/inventory/sell-all', { method: 'POST' })
          : confirm.ids.length === 1
          ? await api<{ balance: string; amount: string; soldCount: number }>(`/api/inventory/${confirm.ids[0]}/sell`, { method: 'POST' })
          : await api<{ balance: string; amount: string; soldCount: number }>('/api/inventory/sell', { body: { ids: confirm.ids } })
      setBalance(r.balance)
      toast.success(`Продано предметов: ${r.soldCount}`, `+${formatMoney(r.amount)} на баланс`)
      setSelected(new Set())
      setSelectMode(false)
      setDetails(null)
      reload()
    } catch (err) {
      toast.error('Продажа не выполнена', (err as ApiError).message)
      reload()
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <div className="container-page">
      <PageHeader
        title="Инвентарь"
        description={data ? `${data.total} предметов · стоимость ${formatMoney(data.totalValue)}` : 'Ваши предметы'}
        actions={
          selectMode ? (
            <>
              <Button variant="ghost" onClick={() => { setSelectMode(false); setSelected(new Set()) }}>
                <X className="size-4" /> Отмена
              </Button>
              <Button variant="success" disabled={selected.size === 0} onClick={() => setConfirm({ ids: [...selected], amount: selectedSum })}>
                <Coins className="size-4" /> Продать {selected.size || ''} · {formatMoney(selectedSum)}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setSelectMode(true)} disabled={!data?.items.length}>
                <CheckSquare className="size-4" /> Выбрать
              </Button>
              <Button variant="success" onClick={() => data && setConfirm({ ids: 'all', amount: D(data.totalValue).mul(data.sellRatio).toFixed(2) })} disabled={!data?.total} data-testid="sell-all-inventory">
                <Coins className="size-4" /> Продать всё
              </Button>
            </>
          )
        }
      />
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Filter
          ariaLabel="Редкость"
          value={rarity}
          onChange={(v) => { setRarity(v); setPage(1) }}
          options={[{ value: 'all' as const, label: 'All' }, ...RARITIES.map((r) => ({ value: r, label: t.rarity[r], color: rarityColor[r] }))]}
        />
        <div className="flex gap-2">
          <Search value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Поиск предмета" className="flex-1 lg:w-56" />
          <select className="input h-10 w-auto" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }} aria-label="Сортировка">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={<Package className="size-5" />}
          title={rarity === 'all' && !search ? 'Инвентарь пуст' : 'Ничего не найдено'}
          description={rarity === 'all' && !search ? 'Откройте первый кейс — предметы появятся здесь.' : 'Попробуйте изменить фильтры.'}
          action={
            <Link href="/cases">
              <Button>Открыть кейсы</Button>
            </Link>
          }
        />
      ) : (
        data && (
          <>
            <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 ${loading ? 'opacity-60' : ''}`}>
              {data.items.map((e) => (
                <InventoryCard
                  key={e.id}
                  entry={e}
                  sellPrice={e.sellPrice}
                  selectMode={selectMode}
                  selected={selected.has(e.id)}
                  onToggle={() => toggle(e.id)}
                  onSell={() => setConfirm({ ids: [e.id], amount: e.sellPrice })}
                  onDetails={() => setDetails(e)}
                  onWithdraw={() => setWithdrawing(e)}
                  busy={busy}
                />
              ))}
            </div>
            <div className="mt-8">
              <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
            </div>
          </>
        )
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title="Продать предметы?"
        confirmLabel={confirm?.ids === 'all' ? `Продать всё ≈ ${formatMoney(confirm.amount)}` : `Продать за ${formatMoney(confirm?.amount ?? 0)}`}
        loading={busy}
        onClose={() => setConfirm(null)}
        onConfirm={doSell}
      >
        {confirm?.ids === 'all'
          ? `Будут проданы все доступные предметы инвентаря (${data?.total ?? 0} шт.).`
          : confirm?.ids.length === 1
            ? 'Предмет будет продан, сумма сразу поступит на баланс.'
            : `Будет продано предметов: ${confirm?.ids.length}.`}{' '}
        Операция необратима.
      </ConfirmModal>

      <SkinWithdrawModal
        entry={withdrawing}
        onClose={() => setWithdrawing(null)}
        onDone={() => {
          setWithdrawing(null)
          reload()
        }}
      />

      <Modal open={Boolean(details)} onClose={() => setDetails(null)} title="Информация о предмете" size="sm">
        {details && (
          <div data-rarity={details.item.rarity}>
            <div className="relative flex h-40 items-center justify-center rounded-lg bg-card">
              <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--r) 35%, transparent), transparent)' }} />
              <Image src={details.item.image} alt={details.item.name} width={200} height={140} className="relative h-28 w-auto" />
            </div>
            <div className="mt-4">
              <RarityBadge rarity={details.item.rarity} />
              <div className="mt-1 font-display text-lg font-bold">{details.item.name}</div>
              {details.item.description && <p className="mt-1 text-sm text-muted">{details.item.description}</p>}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[
                ['Стоимость', formatMoney(details.item.price)],
                ['Цена продажи', formatMoney(details.sellPrice)],
                ['Получен', formatDate(details.createdAt)],
                ['Источник', t.itemSource[details.source as keyof typeof t.itemSource] ?? details.source],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-border bg-bg px-3 py-2">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 font-medium tnum">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirm({ ids: [details.id], amount: details.sellPrice })}>
                <Coins className="size-4" /> Продать
              </Button>
              <Link href={`/upgrade?item=${details.id}`}>
                <Button className="w-full">Апгрейд</Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
