'use client'

/* eslint-disable @next/next/no-img-element */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { sfx } from '@/lib/sound'
import type { ItemDTO, Rarity } from '@/lib/types'

export interface RouletteHandle {
  /** Animates the (server-provided) reel so that `winIndex` stops under the marker. */
  spin: (reel: ItemDTO[], winIndex: number, opts?: { fast?: boolean }) => Promise<void>
  reset: () => void
}

const GAP = 8
/** At most this many tiles are visible at once; fewer on narrow screens. */
const MAX_VISIBLE = 7

/** Decode reel images before spinning so nothing loads mid-animation (the main source of jank). */
function preload(urls: string[], timeoutMs = 2500) {
  const unique = [...new Set(urls)]
  const all = Promise.all(
    unique.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.decoding = 'async'
          img.onload = () => {
            if (img.decode)
              img.decode().then(
                () => resolve(),
                () => resolve(),
              )
            else resolve()
          }
          img.onerror = () => resolve()
          img.src = src
        }),
    ),
  )
  return Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))])
}

function currentX(el: HTMLElement) {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
  return m.m41
}

const BIG: Rarity[] = ['legendary', 'mythic']

/**
 * Pure visualization: the winning item and reel come from the server response.
 * Big tiles (≤ 7 visible), motion blur while fast, the tile under the marker lights up, a short
 * overshoot-and-settle at the end, rarity flash on landing. Web Animations API (compositor-driven).
 */
export const Roulette = forwardRef<RouletteHandle, { idleItems: ItemDTO[]; compact?: boolean; silent?: boolean }>(function Roulette({ idleItems, compact = false, silent = false }, ref) {
  const wrap = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const anims = useRef<Animation[]>([])
  const [card, setCard] = useState(compact ? 128 : 168)
  const cardRef = useRef(card)
  const [items, setItems] = useState<ItemDTO[]>(() => [...idleItems, ...idleItems, ...idleItems].slice(0, 40))
  const [winner, setWinner] = useState<number | null>(null)
  const [spinning, setSpinning] = useState(false)

  // Tile width from the container: MAX_VISIBLE tiles on desktop, at least 3 on phones.
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const vis = Math.min(MAX_VISIBLE, Math.max(3, Math.floor(w / (compact ? 118 : 150))))
      const c = Math.floor((w - (vis - 1) * GAP) / vis)
      cardRef.current = c
      setCard(c)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [compact])

  const reset = useCallback(() => {
    anims.current.forEach((a) => a.cancel())
    anims.current = []
    setWinner(null)
    setSpinning(false)
    if (track.current) {
      track.current.style.transform = 'translate3d(0,0,0)'
      track.current.querySelectorAll('[data-active]').forEach((n) => n.removeAttribute('data-active'))
    }
  }, [])

  const spin = useCallback(
    async (reel: ItemDTO[], winIndex: number, opts?: { fast?: boolean }) => {
      reset()
      await preload(reel.map((r) => r.image))
      setItems(reel)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const el = track.current
      if (!el) return
      setSpinning(true)
      const CARD = cardRef.current
      const w = wrap.current?.clientWidth ?? 800
      const jitter = (Math.random() - 0.5) * CARD * 0.6 // cosmetic landing offset only
      const target = winIndex * (CARD + GAP) + CARD / 2 - w / 2 + jitter
      const fast = Boolean(opts?.fast)
      const duration = fast ? 1000 : 7200
      // Overshoot a little past the landing spot, then settle back — the classic tense finish.
      const overshoot = fast ? 0 : CARD * (0.18 + Math.random() * 0.12)
      if (!silent) sfx.caseOpen()
      const main = el.animate([{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-(target + overshoot)}px,0,0)` }], {
        duration: fast ? duration : duration - 700,
        easing: 'cubic-bezier(0.06, 0.72, 0.12, 1)',
        fill: 'forwards',
      })
      const blur = el.animate([{ filter: 'blur(2.5px)' }, { filter: 'blur(1.5px)', offset: 0.35 }, { filter: 'blur(0px)', offset: 0.6 }, { filter: 'blur(0px)' }], {
        duration: fast ? duration : duration - 700,
        fill: 'forwards',
      })
      anims.current = [main, blur]
      // Tick + highlight the tile under the marker (direct DOM, no React re-render per frame).
      const tiles = el.children
      let last = -1
      let lastX = 0
      let raf = 0
      const loop = () => {
        const x = -currentX(el)
        const idx = Math.floor((x + w / 2) / (CARD + GAP))
        if (idx !== last) {
          if (last !== -1 && !silent) sfx.tick(Math.abs(x - lastX) / 10)
          tiles[last]?.removeAttribute('data-active')
          tiles[idx]?.setAttribute('data-active', '')
          last = idx
        }
        lastX = x
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      try {
        await main.finished
        if (overshoot) {
          const settle = el.animate([{ transform: `translate3d(${-(target + overshoot)}px,0,0)` }, { transform: `translate3d(${-target}px,0,0)` }], {
            duration: 700,
            easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
            fill: 'forwards',
          })
          anims.current.push(settle)
          await settle.finished
        }
      } catch {
        // cancelled
      }
      cancelAnimationFrame(raf)
      el.style.transform = `translate3d(${-target}px,0,0)`
      tiles[last]?.removeAttribute('data-active')
      setSpinning(false)
      setWinner(winIndex)
      if (!silent) sfx.drop(reel[winIndex].rarity)
      await new Promise((r) => setTimeout(r, BIG.includes(reel[winIndex].rarity) ? 900 : 500))
    },
    [reset, silent],
  )

  useImperativeHandle(ref, () => ({ reset, spin }), [reset, spin])

  const won = winner !== null ? items[winner] : null
  const tileH = Math.round(card * (compact ? 0.92 : 1.3))

  return (
    <div
      ref={wrap}
      data-rarity={won?.rarity}
      className={cn('roulette relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-2 py-4 [contain:layout_paint]', spinning && 'roulette-spinning', won && 'roulette-won', won && BIG.includes(won.rarity) && 'roulette-jackpot')}
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-bg-2 to-transparent sm:w-20" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-bg-2 to-transparent sm:w-20" />
      <div className="roulette-marker pointer-events-none absolute inset-y-1 left-1/2 z-20 w-[3px] -translate-x-1/2 rounded-full" />
      <div className="pointer-events-none absolute top-0 left-1/2 z-20 -translate-x-1/2 border-x-[9px] border-t-[11px] border-x-transparent border-t-accent drop-shadow-[0_0_6px_rgb(0_212_255/0.8)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2 border-x-[9px] border-b-[11px] border-x-transparent border-b-accent drop-shadow-[0_0_6px_rgb(0_212_255/0.8)]" />
      <div ref={track} className="flex [backface-visibility:hidden] will-change-transform" style={{ gap: GAP, transform: 'translate3d(0,0,0)' }}>
        {items.map((it, i) => (
          <div
            key={`${it.id}-${i}`}
            data-rarity={it.rarity}
            className={cn(
              'reel-tile slot-bg relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-border',
              winner === i && 'reel-tile-win',
              winner !== null && winner !== i && 'opacity-30 transition-opacity duration-300',
            )}
            style={{ width: card, height: tileH }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(75% 60% at 50% 50%, color-mix(in srgb, var(--r) 30%, transparent), transparent 75%)',
              }}
            />
            <img
              src={it.image}
              alt=""
              width={180}
              height={135}
              loading="eager"
              decoding="async"
              draggable={false}
              className="relative w-auto object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]"
              style={{
                height: Math.round(tileH * (compact ? 0.5 : 0.52)),
                maxWidth: card - 16,
              }}
            />
            <div className={cn('relative mt-1.5 w-full truncate px-2 text-center font-semibold', compact ? 'text-[11px]' : 'text-[13px]')}>{it.name.split(' | ')[0]}</div>
            <div className={cn('relative w-full truncate px-2 text-center text-muted', compact ? 'text-[10px]' : 'text-[11.5px]')}>{it.name.split(' | ')[1]}</div>
            <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: 'var(--r)' }} />
          </div>
        ))}
      </div>
    </div>
  )
})
