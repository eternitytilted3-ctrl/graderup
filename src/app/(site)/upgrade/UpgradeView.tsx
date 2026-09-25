'use client'

import { Plus, X, Zap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ItemCard } from '@/components/domain/ItemCard'
import { PageHeader } from '@/components/domain/PageHeader'
import { rarityColor } from '@/components/domain/RarityBadge'
import { UpgradeCard } from '@/components/domain/UpgradeCard'
import { UpgradeDial, type DialState, type UpgradeDialHandle } from '@/components/domain/UpgradeDial'
import { WinCelebration } from '@/components/domain/WinCelebration'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Search } from '@/components/ui/Search'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, qs } from '@/lib/api'
import { cn } from '@/lib/cn'
import { D, formatMoney } from '@/lib/money'
import { sfx } from '@/lib/sound'
import type { InventoryItemDTO, ItemDTO, Paginated, UpgradeResultDTO } from '@/lib/types'
import { useFetch } from '@/lib/useFetch'

const MAX_SOURCES = 5
type QuickMode = 'x2' | 'x5' | 'x10' | 'c30' | 'c50' | 'c75'

interface Preview {
  chance: string
  sourceValue: string
  potentialWin: string
  potentialLoss: string
  multiplier: string
}

/** Left slot: 1..5 selected source skins. */
function SourcesSlot({ sources, onRemove, disabled, state }: { sources: InventoryItemDTO[]; onRemove: (id: string) => void; disabled: boolean; state: DialState }) {
  if (sources.length <= 1)
    return <UpgradeCard label="Ваши предметы · до 5" item={sources[0]?.item ?? null} placeholder="Выберите до 5 предметов из инвентаря ниже" onClear={disabled || !sources[0] ? undefined : () => onRemove(sources[0].id)} highlight={state === 'loss' ? 'loss' : null} />
  const sum = sources.reduce((s, e) => s.plus(e.item.price), D(0))
  return (
    <div className={cn('flex h-full min-h-52 flex-col rounded-[var(--radius-xl)] border bg-card p-4 transition', state === 'loss' ? 'border-danger/70 opacity-70' : 'border-border-strong')}>
      <div className="flex items-center justify-between">
        <span className="label">Ваши предметы · {sources.length}/{MAX_SOURCES}</span>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-3 gap-2">
        {sources.map((e) => (
          <div key={e.id} data-rarity={e.item.rarity} className="slot-bg group relative flex flex-col items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-border p-1.5">
            <Image src={e.item.image} alt={e.item.name} width={120} height={84} className="h-12 w-auto object-contain" />
            <span className="mt-1 w-full truncate text-center text-[10px] text-muted">{e.item.name.split(' | ')[0]}</span>
            <span className="text-[11px] font-semibold tnum">{formatMoney(e.item.price)}</span>
            <span className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: 'var(--r)' }} />
            {!disabled && (
              <button onClick={() => onRemove(e.id)} className="absolute top-1 right-1 rounded bg-black/50 p-0.5 text-subtle hover:text-text" aria-label={`Убрать ${e.item.name}`}>
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
        {sources.length < MAX_SOURCES && (
          <div className="grid place-items-center rounded-[var(--radius-md)] border border-dashed border-border-strong text-subtle">
            <Plus className="size-4" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted">Сумма</span>
        <span className="font-display text-lg font-bold tnum">{formatMoney(sum.toFixed(2))}</span>
      </div>
    </div>
  )
}

export function UpgradeView({ authed, config }: { authed: boolean; config: { minMultiplier: number; maxMultiplier: number } }) {
  const toast = useToast()
  const params = useSearchParams()
  const [sources, setSources] = useState<InventoryItemDTO[]>([])
  const [target, setTarget] = useState<ItemDTO | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [state, setState] = useState<DialState>('idle')
  const [fast, setFast] = useState(false)
  /** Chance of the last spin — the gauge keeps showing it (and where the needle landed) after the result. */
  const [lastChance, setLastChance] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState<{ x: number; y: number; color: string } | null>(null)
  const dial = useRef<UpgradeDialHandle>(null)
  const dialBox = useRef<HTMLDivElement>(null)
  const [autoMode, setAutoMode] = useState<QuickMode | null>(null)
  const [invPage, setInvPage] = useState(1)
  const [tPage, setTPage] = useState(1)
  const [tSearch, setTSearch] = useState('')
  const [tSort, setTSort] = useState<'price_asc' | 'price_desc'>('price_asc')

  const sourceValue = sources.reduce((s, e) => s.plus(e.item.price), D(0))
  const sourceIds = sources.map((s) => s.id)
  const inv = useFetch<Paginated<InventoryItemDTO>>(authed ? `/api/inventory${qs({ page: invPage, pageSize: 12, sort: 'price_desc' })}` : null)
  const minTarget = sources.length ? sourceValue.mul(config.minMultiplier).toFixed(2) : undefined
  const targets = useFetch<Paginated<ItemDTO>>(`/api/upgrade/targets${qs({ page: tPage, pageSize: 12, minPrice: minTarget, search: tSearch, sort: tSort })}`)

  // Preselect ?item=<userItemId>
  useEffect(() => {
    const id = params.get('item')
    if (!id || !authed) return
    api<InventoryItemDTO>(`/api/inventory/${id}`)
      .then((e) => e.status === 'available' && setSources([e]))
      .catch(() => {})
  }, [params, authed])

  const idsKey = sourceIds.join(',')
  // Chance always comes from the server.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(null)
    if (!idsKey || !target) return
    const c = new AbortController()
    const t = setTimeout(() => {
      api<Preview>('/api/upgrade/preview', { body: { userItemIds: idsKey.split(','), targetItemId: target.id }, signal: c.signal })
        .then(setPreview)
        .catch((e: ApiError) => {
          if (e.name !== 'AbortError') toast.error('Недопустимая комбинация', e.message)
        })
    }, 150)
    return () => {
      clearTimeout(t)
      c.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, target?.id])

  const spinning = state === 'spinning'
  const done = state === 'win' || state === 'loss'

  function resetOutcome() {
    if (done) {
      setState('idle')
      dial.current?.reset()
    }
  }

  function toggleSource(e: InventoryItemDTO) {
    if (spinning) return
    resetOutcome()
    setSources((cur) => {
      if (cur.some((s) => s.id === e.id)) return cur.filter((s) => s.id !== e.id)
      if (cur.length >= MAX_SOURCES) {
        toast.info(`Можно выбрать не больше ${MAX_SOURCES} предметов`)
        return cur
      }
      return [...cur, e]
    })
    setTPage(1)
  }

  // Drop a target that became too cheap for the new source sum.
  useEffect(() => {
    if (target && sources.length && D(target.price).lt(sourceValue.mul(config.minMultiplier))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTarget(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const onCelebrationDone = useCallback(() => setCelebrate(null), [])

  async function run() {
    if (!sources.length || !target || spinning) return
    dial.current?.reset()
    setLastChance(preview ? Number(preview.chance) : null)
    setState('spinning')
    try {
      // The server decides the outcome first; the dial only visualizes the returned roll.
      const r = await api<UpgradeResultDTO>('/api/upgrade', { body: { userItemIds: sourceIds, targetItemId: target.id } })
      await dial.current?.spin(r.rollFraction, { fast, win: r.result === 'win' })
      setState(r.result)
      if (r.result === 'win') {
        sfx.success()
        const box = dialBox.current?.getBoundingClientRect()
        if (box) setCelebrate({ x: box.left + box.width / 2, y: box.top + box.height / 2, color: rarityColor[r.target.rarity] })
        toast.success('Апгрейд успешен!', `${r.target.name} добавлен в инвентарь`)
      } else {
        sfx.fail()
        toast.error('Апгрейд не удался', r.sources.length > 1 ? `Сгорело предметов: ${r.sources.length}` : `${r.sources[0].name} сгорел`)
      }
      setSources([])
      inv.reload()
    } catch (err) {
      setState('idle')
      toast.error('Апгрейд не выполнен', (err as ApiError).message)
      inv.reload()
    }
  }

  async function quick(mode: QuickMode) {
    if (!sources.length || spinning) {
      if (!sources.length) toast.info('Сначала выберите свои предметы')
      return
    }
    resetOutcome()
    setAutoMode(mode)
    try {
      const item = await api<ItemDTO>(`/api/upgrade/auto-target${qs({ userItemIds: idsKey, mode })}`)
      sfx.click()
      setTarget(item)
    } catch (err) {
      toast.error('Не удалось подобрать цель', (err as ApiError).message)
    } finally {
      setAutoMode(null)
    }
  }

  function reset() {
    setSources([])
    setTarget(null)
    setState('idle')
    dial.current?.reset()
  }

  const chanceNum = preview ? Number(preview.chance) : null

  return (
    <div className="container-page">
      <PageHeader
        eyebrow="Upgrade"
        title="Апгрейд предметов"
        description={`Выберите до ${MAX_SOURCES} своих предметов и цель дороже минимум в ${config.minMultiplier}× их суммы. Чем выше множитель — тем ниже шанс.`}
        actions={<SoundToggle />}
      />

      <section id="upgrade-panel" className="card grid scroll-mt-20 items-stretch gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-8" aria-label="Апгрейд">
        <SourcesSlot sources={sources} onRemove={(id) => setSources((c) => c.filter((s) => s.id !== id))} disabled={spinning} state={state} />
        <div className="flex flex-col items-center justify-center gap-3 py-2">
          <div ref={dialBox} className="flex w-full justify-center">
            <UpgradeDial ref={dial} chance={done || spinning ? lastChance : chanceNum} state={state} />
          </div>
          {done ? (
            <button onClick={reset} className="upgrade-btn w-full max-w-[340px]" data-variant="again">
              Новый апгрейд
            </button>
          ) : authed ? (
            <button onClick={run} disabled={!preview || spinning} className="upgrade-btn w-full max-w-[340px]" data-testid="upgrade-button" aria-busy={spinning}>
              {spinning ? 'Крутим…' : preview ? `Апгрейд ×${preview.multiplier}` : 'Апгрейд'}
            </button>
          ) : (
            <Link href="/login?next=/upgrade" className="upgrade-btn w-full max-w-[340px]">
              Войдите для апгрейда
            </Link>
          )}
          <dl className="grid w-full max-w-[340px] grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-md border border-border bg-bg px-2 py-2">
              <dt className="text-muted">Выигрыш</dt>
              <dd className="mt-0.5 font-display text-sm font-bold text-success tnum">{preview ? `+${formatMoney(preview.potentialWin)}` : '—'}</dd>
            </div>
            <div className="rounded-md border border-border bg-bg px-2 py-2">
              <dt className="text-muted">Потеря</dt>
              <dd className="mt-0.5 font-display text-sm font-bold text-danger tnum">{preview ? `−${formatMoney(preview.potentialLoss)}` : '—'}</dd>
            </div>
          </dl>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="size-4 accent-[#7C5CFF]" data-testid="upgrade-fast" />
            <Zap className="size-3.5" /> Быстрая прокрутка
          </label>
        </div>
        <UpgradeCard label="Цель" item={target} placeholder="Выберите цель из списка или кнопкой ниже" onClear={spinning ? undefined : () => { setTarget(null); resetOutcome() }} highlight={state === 'win' ? 'win' : null} />
      </section>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Быстрый выбор цели">
        {(
          [
            ['x2', '×2'],
            ['x5', '×5'],
            ['x10', '×10'],
            ['c30', '30%'],
            ['c50', '50%'],
            ['c75', '75%'],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => quick(mode)}
            disabled={spinning || autoMode !== null}
            data-testid={`quick-${mode}`}
            className="h-11 rounded-[var(--radius-md)] border border-border bg-card font-display text-base font-semibold tracking-wide transition hover:border-accent/60 hover:bg-accent/10 hover:text-accent disabled:opacity-50"
          >
            {autoMode === mode ? '…' : label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-label="Инвентарь для апгрейда">
          <h2 className="mb-4 flex items-center justify-between font-display text-lg font-bold">
            Ваш инвентарь
            {sources.length > 0 && (
              <button onClick={() => setSources([])} disabled={spinning} className="text-xs font-normal text-muted hover:text-text">
                Снять выбор ({sources.length})
              </button>
            )}
          </h2>
          {!authed ? (
            <EmptyState title="Войдите в аккаунт" description="Чтобы выбрать предметы для апгрейда, нужно войти." action={<Link href="/login?next=/upgrade"><Button>Войти</Button></Link>} />
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
                  <ItemCard key={e.id} item={e.item} size="sm" selected={sources.some((s) => s.id === e.id)} onClick={spinning ? undefined : () => toggleSource(e)} />
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
                  const ratio = sources.length ? D(i.price).div(sourceValue) : null
                  const tooFar = ratio ? ratio.gt(config.maxMultiplier) : false
                  return (
                    <ItemCard
                      key={i.id}
                      item={i}
                      size="sm"
                      dimmed={tooFar}
                      selected={target?.id === i.id}
                      onClick={
                        spinning || tooFar
                          ? undefined
                          : () => {
                              setTarget(i)
                              resetOutcome()
                              if (window.innerWidth < 1024) document.getElementById('upgrade-panel')?.scrollIntoView({ behavior: 'smooth' })
                            }
                      }
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
      {celebrate && <WinCelebration origin={celebrate} color={celebrate.color} onDone={onCelebrationDone} />}
    </div>
  )
}
