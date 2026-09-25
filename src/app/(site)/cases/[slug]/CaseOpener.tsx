'use client'

import { Coins, PackageCheck, RotateCcw, Zap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Roulette, type RouletteHandle } from '@/components/domain/Roulette'
import { WinCelebration } from '@/components/domain/WinCelebration'
import { RarityBadge, rarityColor } from '@/components/domain/RarityBadge'
import { useSession } from '@/components/SessionProvider'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { D, formatMoney } from '@/lib/money'
import { sfx } from '@/lib/sound'
import type { CaseItemDTO, OpenCasesResult } from '@/lib/types'

const COUNTS = [1, 2, 3, 4, 5] as const

function shuffled<T>(arr: T[], seed: number) {
  const a = [...arr]
  let s = seed + 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type Phase = 'idle' | 'opening' | 'spinning' | 'done'

/** Crate on its pedestal; shakes, flashes and bursts open when `phase` is 'opening'. */
function CrateStage({ image, name, phase, fast }: { image: string; name: string; phase: Phase; fast: boolean }) {
  return (
    <div className="crate-stage relative flex h-60 items-center justify-center overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-2 sm:h-72" data-phase={phase}>
      <div className="crate-rays pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[140%] -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none absolute inset-x-[25%] bottom-6 h-6 rounded-[50%] bg-black/60 blur-lg" />
      <Image src={image} alt={`Кейс ${name}`} width={320} height={246} priority className={cn('relative h-48 w-auto drop-shadow-[0_24px_36px_rgba(0,0,0,0.55)] sm:h-60', phase === 'opening' ? (fast ? 'crate-opening-fast' : 'crate-opening') : 'crate-idle')} />
      {phase === 'opening' && !fast && <div className="crate-flash pointer-events-none absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,#fff,rgb(0_212_255/0.6)_40%,transparent)]" />}
    </div>
  )
}

export function CaseOpener({ caseId, slug, name, image, price, items }: { caseId: string; slug: string; name: string; image: string; price: string; items: CaseItemDTO[] }) {
  const { user, setBalance } = useSession()
  const toast = useToast()
  const [count, setCount] = useState<number>(1)
  const [reels, setReels] = useState(1)
  const handles = useRef<(RouletteHandle | null)[]>([])
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [fast, setFast] = useState(false)
  const [result, setResult] = useState<OpenCasesResult | null>(null)
  const [sold, setSold] = useState<Set<string>>(new Set())
  const [selling, setSelling] = useState(false)
  const [celebrate, setCelebrate] = useState<{
    x: number
    y: number
    color: string
  } | null>(null)
  const onCelebrated = useCallback(() => setCelebrate(null), [])
  const idle = useMemo(() => COUNTS.map((_, i) => shuffled(items, i)), [items])

  const total = D(price).mul(count)
  const insufficient = user ? D(user.balance).lt(total) : false

  async function open(n = count) {
    if (busy) return
    setBusy(true)
    setResult(null)
    setSold(new Set())
    try {
      // 1. Server decides every result (and debits the balance) before any animation.
      const r = await api<OpenCasesResult>(`/api/cases/${caseId}/open`, {
        body: { count: n },
      })
      setReels(n)
      setBalance(r.balance)
      // 2. Animations only visualize the returned results: crate bursts open, then the reels spin.
      setPhase('opening')
      sfx.crateUnlock()
      await new Promise((res) => setTimeout(res, fast ? 350 : 1150))
      setPhase('spinning')
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))
      await Promise.all(r.results.map((drop, i) => handles.current[i]?.spin(drop.reel, drop.winIndex, { fast })))
      setPhase('done')
      setResult(r)
      // "Окуп": at least one drop is worth more than the case → celebrate.
      const best = [...r.results].sort((a, b) => Number(b.item.price) - Number(a.item.price))[0]
      if (best && D(best.item.price).gt(price)) {
        sfx.success()
        setCelebrate({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          color: rarityColor[best.item.rarity],
        })
      }
    } catch (err) {
      const e = err as ApiError
      toast.error(e.code === 'INSUFFICIENT_FUNDS' ? 'Недостаточно средств' : 'Не удалось открыть кейс', e.message)
      setPhase('idle')
    } finally {
      setBusy(false)
    }
  }

  async function sell(ids: string[]) {
    if (!ids.length) return
    setSelling(true)
    try {
      const r = ids.length === 1 ? await api<{ balance: string; amount: string }>(`/api/inventory/${ids[0]}/sell`, { method: 'POST' }) : await api<{ balance: string; amount: string }>('/api/inventory/sell', { body: { ids } })
      setBalance(r.balance)
      sfx.coin()
      toast.success(`Продано за ${formatMoney(r.amount)}`)
      const next = new Set(sold)
      ids.forEach((id) => next.add(id))
      setSold(next)
      if (result && result.results.every((d) => next.has(d.userItemId))) setResult(null)
    } catch (err) {
      toast.error('Не удалось продать', (err as ApiError).message)
    } finally {
      setSelling(false)
    }
  }

  const remaining = result?.results.filter((d) => !sold.has(d.userItemId)) ?? []
  const remainingSum = remaining.reduce((s, d) => s.plus(d.sellPrice), D(0))

  return (
    <section aria-label="Открытие кейса">
      {phase === 'idle' || phase === 'opening' ? (
        <CrateStage image={image} name={name} phase={phase} fast={fast} />
      ) : (
        <div className="roulette-enter flex min-h-60 flex-col justify-center space-y-2 sm:min-h-72">
          {COUNTS.slice(0, reels).map((_, i) => (
            <Roulette
              key={i}
              ref={(h) => {
                handles.current[i] = h
              }}
              idleItems={idle[i]}
              compact={reels > 1}
              silent={i > 0}
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-col items-center gap-3">
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Количество кейсов">
          {COUNTS.map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={count === n}
              disabled={busy}
              onClick={() => {
                setCount(n)
                if (!busy) {
                  setReels(n)
                  setPhase('idle')
                }
              }}
              data-testid={`count-${n}`}
              className={cn('h-10 w-12 rounded-[var(--radius-md)] border font-display text-base font-semibold transition disabled:opacity-50', count === n ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-card text-muted hover:border-border-strong hover:text-text')}
            >
              ×{n}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {user ? (
            insufficient && !busy ? (
              <Link href="/deposit" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto sm:min-w-72">
                  <Coins className="size-4" /> Пополнить баланс
                </Button>
              </Link>
            ) : (
              <Button size="lg" onClick={() => open()} loading={busy} className="w-full sm:w-auto sm:min-w-72" data-testid="open-case">
                {busy ? 'Открываем…' : `Открыть ${count > 1 ? `${count} кейса · ` : 'кейс · '}${formatMoney(total.toFixed(2))}`}
              </Button>
            )
          ) : (
            <Link href={`/login?next=/cases/${slug}`} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto sm:min-w-72">
                Войдите, чтобы открыть
              </Button>
            </Link>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="size-4 accent-[#7C5CFF]" />
            <Zap className="size-3.5" /> Быстрое открытие
          </label>
          <SoundToggle />
        </div>
        {insufficient && user && !busy && (
          <p className="text-center text-xs text-muted">
            На балансе {formatMoney(user.balance)} — не хватает {formatMoney(total.minus(user.balance).toFixed(2))}
          </p>
        )}
      </div>

      <Modal
        open={Boolean(result) && remaining.length > 0}
        onClose={() => {
          setResult(null)
          setPhase('idle')
        }}
        title={remaining.length > 1 ? `Ваши дропы · ${remaining.length}` : 'Ваш дроп'}
        size={remaining.length > 2 ? 'lg' : 'sm'}
      >
        {result && (
          <div className="flex flex-col items-center text-center">
            <div className={cn('grid w-full gap-3', remaining.length === 1 ? 'grid-cols-1' : remaining.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
              {remaining.map((d) => (
                <div
                  key={d.userItemId}
                  data-rarity={d.item.rarity}
                  data-profit={D(d.item.price).gt(price) || undefined}
                  className={cn('slot-bg relative flex flex-col items-center overflow-hidden rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--r)_50%,transparent)] p-3', D(d.item.price).gt(price) && 'profit-card')}
                >
                  {D(d.item.price).gt(price) && (
                    <span className="absolute top-2 left-2 z-10 rounded bg-success px-1.5 py-0.5 font-display text-[11px] font-bold tracking-wide text-[#05140c] uppercase" data-testid="profit-badge">
                      Окуп ×{D(d.item.price).div(price).toDecimalPlaces(1).toString()}
                    </span>
                  )}
                  <div className="relative flex h-28 w-full items-center justify-center">
                    <div
                      className="absolute inset-0 animate-pop rounded-full"
                      style={{
                        background: 'radial-gradient(closest-side, color-mix(in srgb, var(--r) 45%, transparent), transparent)',
                      }}
                    />
                    <Image src={d.item.image} alt={d.item.name} width={200} height={140} className="relative h-24 w-auto animate-pop object-contain" />
                  </div>
                  <RarityBadge rarity={d.item.rarity} />
                  <div className="mt-1 line-clamp-2 min-h-8 text-xs font-semibold" data-testid="drop-name">
                    {d.item.name}
                  </div>
                  <div className="mt-1 font-display text-lg font-bold tnum">{formatMoney(d.item.price)}</div>
                  {remaining.length > 1 && (
                    <button onClick={() => sell([d.userItemId])} disabled={selling} className="mt-2 text-xs text-muted hover:text-success disabled:opacity-50">
                      Продать · {formatMoney(d.sellPrice)}
                    </button>
                  )}
                  <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: 'var(--r)' }} />
                </div>
              ))}
            </div>
            <div className="mt-5 grid w-full gap-2 sm:grid-cols-2">
              <Button variant="secondary" onClick={() => sell(remaining.map((d) => d.userItemId))} loading={selling} data-testid="sell-all">
                <Coins className="size-4" /> {remaining.length > 1 ? 'Продать всё' : 'Продать'} · {formatMoney(remainingSum.toFixed(2))}
              </Button>
              <Button
                onClick={() => {
                  setResult(null)
                  setPhase('idle')
                }}
              >
                <PackageCheck className="size-4" /> В инвентарь
              </Button>
            </div>
            <button
              onClick={() => {
                setResult(null)
                void open()
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text"
            >
              <RotateCcw className="size-3.5" /> Открыть ещё раз
            </button>
          </div>
        )}
      </Modal>
      {celebrate && <WinCelebration origin={celebrate} color={celebrate.color} onDone={onCelebrated} />}
    </section>
  )
}
