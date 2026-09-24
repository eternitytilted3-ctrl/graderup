'use client'

/* eslint-disable @next/next/no-img-element */
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { sfx } from '@/lib/sound'
import type { ItemDTO } from '@/lib/types'

export interface RouletteHandle {
  /** Animates the (server-provided) reel so that `winIndex` stops under the marker. */
  spin: (reel: ItemDTO[], winIndex: number, opts?: { fast?: boolean }) => Promise<void>
  reset: () => void
}

const CARD = 128
const GAP = 8
const PAD = 8

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
            if (img.decode) img.decode().then(() => resolve(), () => resolve())
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

/**
 * Pure visualization: the winning item and reel come from the server response.
 * Uses the Web Animations API (compositor-driven, unaffected by CSS reduced-motion overrides).
 */
export const Roulette = forwardRef<RouletteHandle, { idleItems: ItemDTO[] }>(function Roulette({ idleItems }, ref) {
  const wrap = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const anim = useRef<Animation | null>(null)
  const [items, setItems] = useState<ItemDTO[]>(() => [...idleItems, ...idleItems, ...idleItems].slice(0, 40))
  const [winner, setWinner] = useState<number | null>(null)

  const reset = useCallback(() => {
    anim.current?.cancel()
    anim.current = null
    setWinner(null)
    if (track.current) track.current.style.transform = 'translate3d(0,0,0)'
  }, [])

  const spin = useCallback(
    async (reel: ItemDTO[], winIndex: number, opts?: { fast?: boolean }) => {
      reset()
      await preload(reel.map((r) => r.image))
      setItems(reel)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const el = track.current
      if (!el) return
      const w = wrap.current?.clientWidth ?? 800
      const jitter = (Math.random() - 0.5) * CARD * 0.7 // cosmetic landing offset only
      const target = PAD + winIndex * (CARD + GAP) + CARD / 2 - w / 2 + jitter
      const duration = opts?.fast ? 900 : 6500
      sfx.caseOpen()
      const a = el.animate([{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-target}px,0,0)` }], {
        duration,
        easing: 'cubic-bezier(0.08, 0.7, 0.1, 1)',
        fill: 'forwards',
      })
      anim.current = a
      // Tick each time a card crosses the centre marker.
      let last = -1
      let lastX = 0
      let raf = 0
      const loop = () => {
        const x = -currentX(el)
        const idx = Math.floor((x + w / 2 - PAD) / (CARD + GAP))
        if (idx !== last) {
          if (last !== -1) sfx.tick(Math.abs(x - lastX) / 8)
          last = idx
        }
        lastX = x
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      try {
        await a.finished
      } catch {
        // cancelled
      }
      cancelAnimationFrame(raf)
      el.style.transform = `translate3d(${-target}px,0,0)`
      setWinner(winIndex)
      sfx.drop(reel[winIndex].rarity)
      await new Promise((r) => setTimeout(r, 450))
    },
    [reset],
  )

  useImperativeHandle(ref, () => ({ reset, spin }), [reset, spin])

  return (
    <div ref={wrap} className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-2 py-5 [contain:layout_paint]" aria-live="polite">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg-2 to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg-2 to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-2 left-1/2 z-20 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-accent via-primary to-accent shadow-[0_0_14px_2px_rgb(0_212_255/0.55)]" />
      <div className="pointer-events-none absolute top-0 left-1/2 z-20 -translate-x-1/2 border-x-[7px] border-t-[8px] border-x-transparent border-t-accent" />
      <div ref={track} className="flex gap-2 [backface-visibility:hidden] will-change-transform" style={{ paddingLeft: PAD, transform: 'translate3d(0,0,0)' }}>
        {items.map((it, i) => (
          <div
            key={`${it.id}-${i}`}
            data-rarity={it.rarity}
            className={cn(
              'slot-bg relative flex h-36 shrink-0 flex-col items-center justify-center overflow-hidden rounded-[var(--radius-md)] border',
              winner === i ? 'z-10 scale-105 border-[var(--r)] shadow-[0_0_28px_-4px_var(--r)] transition-transform duration-300' : 'border-border',
              winner !== null && winner !== i && 'opacity-35 transition-opacity duration-300',
            )}
            style={{ width: CARD }}
          >
            <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 60% at 50% 55%, color-mix(in srgb, var(--r) 26%, transparent), transparent 75%)' }} />
            <img src={it.image} alt="" width={112} height={84} loading="eager" decoding="async" draggable={false} className="relative h-16 w-auto max-w-[112px] object-contain" />
            <div className="relative mt-2 w-full truncate px-2 text-center text-[11px] font-semibold">{it.name.split(' | ')[0]}</div>
            <div className="relative w-full truncate px-2 text-center text-[10px] text-muted">{it.name.split(' | ')[1]}</div>
            <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: 'var(--r)' }} />
          </div>
        ))}
      </div>
    </div>
  )
})
