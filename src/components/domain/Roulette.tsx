'use client'

import Image from 'next/image'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { ItemDTO } from '@/lib/types'

export interface RouletteHandle {
  /** Animates the (server-provided) reel so that `winIndex` stops under the marker. */
  spin: (reel: ItemDTO[], winIndex: number, opts?: { fast?: boolean }) => Promise<void>
  reset: () => void
}

const CARD = 128
const GAP = 8

/**
 * Pure visualization: the winning item and reel come from the server response.
 * Nothing here influences the outcome.
 */
export const Roulette = forwardRef<RouletteHandle, { idleItems: ItemDTO[] }>(function Roulette({ idleItems }, ref) {
  const wrap = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<ItemDTO[]>(() => [...idleItems, ...idleItems, ...idleItems].slice(0, 40))
  const [winner, setWinner] = useState<number | null>(null)
  const [blur, setBlur] = useState(false)

  const reset = useCallback(() => {
    setWinner(null)
    if (track.current) {
      track.current.style.transition = 'none'
      track.current.style.transform = 'translate3d(0,0,0)'
    }
  }, [])

  const spin = useCallback(
    (reel: ItemDTO[], winIndex: number, opts?: { fast?: boolean }) =>
      new Promise<void>((resolve) => {
        reset()
        setItems(reel)
        const run = () => {
          const el = track.current
          const w = wrap.current?.clientWidth ?? 800
          if (!el) return resolve()
          const jitter = (Math.random() - 0.5) * CARD * 0.7 // cosmetic landing offset only
          const target = winIndex * (CARD + GAP) + CARD / 2 - w / 2 + jitter
          const duration = opts?.fast ? 700 : 6200
          el.style.transition = `transform ${duration}ms cubic-bezier(0.1, 0.72, 0.12, 1)`
          el.style.transform = `translate3d(${-target}px,0,0)`
          if (!opts?.fast) {
            setBlur(true)
            setTimeout(() => setBlur(false), duration * 0.45)
          }
          // transitionend can be skipped (hidden tab, reduced motion) — use a timer as the source of truth.
          setTimeout(() => {
            setWinner(winIndex)
            setTimeout(resolve, 350)
          }, duration + 50)
        }
        requestAnimationFrame(() => requestAnimationFrame(run))
      }),
    [reset],
  )

  useImperativeHandle(ref, () => ({ reset, spin }), [reset, spin])

  useEffect(() => reset, [reset])

  return (
    <div ref={wrap} className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-2 py-5" aria-live="polite">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg-2 to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg-2 to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-2 left-1/2 z-20 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-accent via-primary to-accent shadow-[0_0_14px_2px_rgb(0_212_255/0.55)]" />
      <div className="pointer-events-none absolute top-0 left-1/2 z-20 -translate-x-1/2 border-x-[7px] border-t-[8px] border-x-transparent border-t-accent" />
      <div ref={track} className={cn('flex gap-2 pl-2 will-change-transform', blur && '[filter:blur(1.2px)]')} style={{ transform: 'translate3d(0,0,0)' }}>
        {items.map((it, i) => (
          <div
            key={`${it.id}-${i}`}
            data-rarity={it.rarity}
            className={cn(
              'relative flex h-36 shrink-0 flex-col items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border bg-card transition-all duration-300',
              winner === i ? 'z-10 scale-105 border-[var(--r)] shadow-[0_0_28px_-4px_var(--r)]' : 'border-border',
              winner !== null && winner !== i && 'opacity-35',
            )}
            style={{ width: CARD }}
          >
            <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 60% at 50% 55%, color-mix(in srgb, var(--r) 26%, transparent), transparent 75%)' }} />
            <Image src={it.image} alt="" width={200} height={140} className="relative h-16 w-auto" />
            <div className="relative mt-2 w-full truncate px-2 text-center text-[11px] font-semibold">{it.name.split(' | ')[0]}</div>
            <div className="relative w-full truncate px-2 text-center text-[10px] text-muted">{it.name.split(' | ')[1]}</div>
            <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: 'var(--r)' }} />
          </div>
        ))}
      </div>
    </div>
  )
})
