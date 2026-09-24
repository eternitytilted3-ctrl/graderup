'use client'

import { ArrowDown, ArrowRight, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ItemCard } from '@/components/domain/ItemCard'
import { PageHeader } from '@/components/domain/PageHeader'
import { UpgradeCard } from '@/components/domain/UpgradeCard'
import { UpgradeDial, type DialState } from '@/components/domain/UpgradeDial'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Search } from '@/components/ui/Search'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, qs } from '@/lib/api'
import { D, formatMoney } from '@/lib/money'
import type { InventoryItemDTO, ItemDTO, Paginated, UpgradeResultDTO } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

interface Preview {
  chance: string
  potentialWin: string
  potentialLoss: string
  multiplier: string
}

export function UpgradeView({ authed, config }: { authed: boolean; config: { minMultiplier: number; maxMultiplier: number } }) {
  const toast = useToast()
  const params = useSearchParams()
  const [source, setSource] = useState<InventoryItemDTO | null>(null)
  const [target, setTarget] = useState<ItemDTO | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [state, setState] = useState<DialState>('idle')
  const [result, setResult] = useState<UpgradeResultDTO | null>(null)
  const [invPage, setInvPage] = useState(1)
  const [tPage, setTPage] = useState(1)
  const [tSearch, setTSearch] = useState('')
  const [tSort, setTSort] = useState<'price_asc' | 'price_desc'>('price_asc')

  const inv = useFetch<Paginated<InventoryItemDTO>>(authed ? `/api/inventory${qs({ page: invPage, pageSize: 12, sort: 'price_desc' })}` : null)
  const minTarget = source ? D(source.item.price).mul(config.minMultiplier).toFixed(2) : undefined
  const targets = useFetch<Paginated<ItemDTO>>(`/api/upgrade/targets${qs({ page: tPage, pageSize: 12, minPrice: minTarget, search: tSearch, sort: tSort })}`)

  // Preselect ?item=<userItemId>
  useEffect(() => {
    const id = params.get('item')
    if (!id || !authed) return
    api<InventoryItemDTO>(`/api/inventory/${id}`)
      .then((e) => e.status === 'available' && setSource(e))
      .catch(() => {})
  }, [params, authed])

  // Chance always comes from the server.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(null)
    if (!source || !target) return
    const c = new AbortController()
    const t = setTimeout(() => {
      api<Preview>('/api/upgrade/preview', { body: { userItemId: source.id, targetItemId: target.id }, signal: c.signal })
        .then(setPreview)
        .catch((e: ApiError) => {
          if (e.name !== 'AbortError') toast.error('Недопустимая пара', e.message)
        })
    }, 150)
    return () => {
      clearTimeout(t)
      c.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.id, target?.id])

  const spinning = state === 'spinning'

  async function run() {
    if (!source || !target || spinning) return
    setResult(null)
    setState('idle')
    try {
      const r = await api<UpgradeResultDTO>('/api/upgrade', { body: { userItemId: source.id, targetItemId: target.id } })
      setResult(r)
      requestAnimationFrame(() => setState('spinning'))
      setTimeout(() => {
        setState(r.result)
        if (r.result === 'win') toast.success('Апгрейд успешен!', `${r.target.name} добавлен в инвентарь`)
        else toast.error('Апгрейд не удался', `${r.source.name} сгорел`)
        inv.reload()
      }, 3900)
    } catch (err) {
      setState('idle')
      toast.error('Апгрейд не выполнен', (err as ApiError).message)
      inv.reload()
    }
  }

  function reset() {
    setSource(null)
    setTarget(null)
    setResult(null)
    setState('idle')
  }

  const done = state === 'win' || state === 'loss'
  const chanceNum = preview ? Number(preview.chance) : null

  return (
    <div className="container-page">
      <PageHeader eyebrow="Upgrade" title="Апгрейд предмета" description={`Выберите предмет и цель дороже минимум в ${config.minMultiplier}×. Чем выше множитель — тем ниже шанс.`} />

      <section id="upgrade-panel" className="card grid scroll-mt-20 items-stretch gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-8" aria-label="Апгрейд">
        <UpgradeCard label="Ваш предмет" item={source?.item ?? null} placeholder="Выберите предмет из инвентаря ниже" onClear={spinning ? undefined : () => { setSource(null); setState('idle') }} highlight={state === 'loss' ? 'loss' : null} />
        <div className="flex flex-col items-center justify-center gap-4 py-2">
          <ArrowRight className="hidden size-5 text-subtle lg:block" />
          <ArrowDown className="size-5 text-subtle lg:hidden" />
          <UpgradeDial chance={chanceNum} state={state} rollFraction={result?.rollFraction ?? null} />
          <dl className="grid w-full max-w-[280px] grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-md border border-border bg-bg px-2 py-2">
              <dt className="text-muted">Выигрыш</dt>
              <dd className="mt-0.5 font-display text-sm font-bold text-success tnum">{preview ? `+${formatMoney(preview.potentialWin)}` : '—'}</dd>
            </div>
            <div className="rounded-md border border-border bg-bg px-2 py-2">
              <dt className="text-muted">Потеря</dt>
              <dd className="mt-0.5 font-display text-sm font-bold text-danger tnum">{preview ? `−${formatMoney(preview.potentialLoss)}` : '—'}</dd>
            </div>
          </dl>
          {done ? (
            <Button size="lg" variant="secondary" onClick={reset} className="w-full max-w-[280px]">
              Новый апгрейд
            </Button>
          ) : authed ? (
            <Button size="lg" onClick={run} disabled={!preview} loading={spinning} className="w-full max-w-[280px]" data-testid="upgrade-button">
              <TrendingUp className="size-4" /> {preview ? `Upgrade ×${preview.multiplier}` : 'Upgrade'}
            </Button>
          ) : (
            <Link href="/login?next=/upgrade" className="w-full max-w-[280px]">
              <Button size="lg" className="w-full">
                Войдите для апгрейда
              </Button>
            </Link>
          )}
        </div>
        <UpgradeCard label="Цель" item={target} placeholder="Выберите целевой предмет из списка" onClear={spinning ? undefined : () => { setTarget(null); setState('idle') }} highlight={state === 'win' ? 'win' : null} />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-label="Инвентарь для апгрейда">
          <h2 className="mb-4 font-display text-lg font-bold">Ваш инвентарь</h2>
          {!authed ? (
            <EmptyState title="Войдите в аккаунт" description="Чтобы выбрать предмет для апгрейда, нужно войти." action={<Link href="/login?next=/upgrade"><Button>Войти</Button></Link>} />
          ) : inv.error ? (
            <ErrorState description={inv.error.message} onRetry={inv.reload} />
          ) : !inv.data ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : inv.data.items.length === 0 ? (
            <EmptyState title="Нет доступных предметов" description="Откройте кейс, чтобы получить предметы." action={<Link href="/cases"><Button>К кейсам</Button></Link>} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {inv.data.items.map((e) => (
                  <ItemCard
                    key={e.id}
                    item={e.item}
                    size="sm"
                    selected={source?.id === e.id}
                    onClick={spinning ? undefined : () => { setSource(e); setState('idle'); setResult(null); if (target && D(target.price).lt(D(e.item.price).mul(config.minMultiplier))) setTarget(null); setTPage(1) }}
                  />
                ))}
              </div>
              <div className="mt-5">
                <Pagination page={inv.data.page} totalPages={inv.data.totalPages} onChange={setInvPage} />
              </div>
            </>
          )}
        </section>
        <section aria-label="Целевые предметы">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">Выберите цель</h2>
            <div className="flex w-full gap-2 sm:w-auto">
              <Search value={tSearch} onChange={(v) => { setTSearch(v); setTPage(1) }} placeholder="Поиск" className="flex-1 sm:w-44" />
              <select className="input h-10 w-auto" value={tSort} onChange={(e) => { setTSort(e.target.value as typeof tSort); setTPage(1) }} aria-label="Сортировка целей">
                <option value="price_asc">Дешевле</option>
                <option value="price_desc">Дороже</option>
              </select>
            </div>
          </div>
          {targets.error ? (
            <ErrorState description={targets.error.message} onRetry={targets.reload} />
          ) : !targets.data ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : targets.data.items.length === 0 ? (
            <EmptyState title="Нет подходящих целей" />
          ) : (
            <>
              <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 ${targets.loading ? 'opacity-60' : ''}`}>
                {targets.data.items.map((i) => {
                  const ratio = source ? D(i.price).div(source.item.price) : null
                  const tooFar = ratio ? ratio.gt(config.maxMultiplier) : false
                  return (
                    <ItemCard
                      key={i.id}
                      item={i}
                      size="sm"
                      dimmed={tooFar}
                      selected={target?.id === i.id}
                      onClick={spinning || tooFar ? undefined : () => { setTarget(i); setState('idle'); setResult(null); if (window.innerWidth < 1024) document.getElementById('upgrade-panel')?.scrollIntoView({ behavior: 'smooth' }) }}
                      topRight={ratio ? <span className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-accent tnum">×{ratio.toDecimalPlaces(1).toString()}</span> : undefined}
                    />
                  )
                })}
              </div>
              <div className="mt-5">
                <Pagination page={targets.data.page} totalPages={targets.data.totalPages} onChange={setTPage} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
