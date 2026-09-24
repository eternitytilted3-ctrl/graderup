'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'
import { sfx } from '@/lib/sound'
import { cn } from '@/lib/cn'

export type DialState = 'idle' | 'spinning' | 'win' | 'loss'

const R = 88
const C = 2 * Math.PI * R

export interface UpgradeDialHandle {
  /** Spins the pointer ~5 turns and lands on the server roll (0..1 of the circle). */
  spin: (rollFraction: number, opts?: { fast?: boolean }) => Promise<void>
  reset: () => void
}

/**
 * Chance ring. The winning arc starts at 12 o'clock and covers `chance`% of the circle.
 * The pointer lands on `rollFraction` × 360° — the server's roll — so it lands inside the arc
 * exactly when the server says "win". Purely a visualization (Web Animations API).
 */
export const UpgradeDial = forwardRef<UpgradeDialHandle, { chance: number | null; state: DialState }>(function UpgradeDial({ chance, state }, ref) {
  const pointer = useRef<HTMLDivElement>(null)
  const anim = useRef<Animation | null>(null)

  useImperativeHandle(ref, () => ({
    reset() {
      anim.current?.cancel()
      anim.current = null
      if (pointer.current) pointer.current.style.transform = 'rotate(0deg)'
    },
    async spin(rollFraction: number, opts?: { fast?: boolean }) {
      const el = pointer.current
      if (!el) return
      anim.current?.cancel()
      const end = (opts?.fast ? 2 : 5) * 360 + rollFraction * 360
      sfx.upgradeStart()
      const a = el.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${end}deg)` }], {
        duration: opts?.fast ? 1100 : 4200,
        easing: 'cubic-bezier(0.12, 0.72, 0.1, 1)',
        fill: 'forwards',
      })
      anim.current = a
      // Tick every 18° travelled (effect-level easing → computed progress already eased).
      let lastStep = 0
      let raf = 0
      const loop = () => {
        const progress = a.effect?.getComputedTiming().progress ?? 0
        const step = Math.floor((end * progress) / 18)
        if (step !== lastStep) {
          sfx.tick(Math.min(3, step - lastStep))
          lastStep = step
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      try {
        await a.finished
      } catch {}
      cancelAnimationFrame(raf)
      el.style.transform = `rotate(${end}deg)`
    },
  }))

  const pct = chance ?? 0
  const arc = (Math.min(100, Math.max(0, pct)) / 100) * C
  return (
    <div className={cn('relative aspect-square w-full max-w-[240px]', state === 'loss' && 'animate-[shake_0.5s_ease-in-out]')}>
      <style>{`@keyframes shake{0%,100%{transform:none}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}`}</style>
      <div
        className={cn(
          'absolute inset-4 rounded-full transition-all duration-500',
          state === 'win' && 'shadow-[0_0_60px_10px_rgb(53_208_127/0.35)]',
          state === 'loss' && 'shadow-[0_0_60px_6px_rgb(255_85_112/0.3)]',
          state === 'spinning' && 'shadow-[0_0_70px_4px_rgb(0_212_255/0.35)]',
          state === 'idle' && 'shadow-[0_0_50px_-6px_rgb(124_92_255/0.45)]',
        )}
      />
      <svg viewBox="0 0 200 200" className="relative size-full -rotate-90">
        <defs>
          <linearGradient id="dialg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7C5CFF" />
            <stop offset="1" stopColor="#00D4FF" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={R} stroke="#1a2130" strokeWidth="12" fill="#0D111A" />
        {Array.from({ length: 60 }).map((_, i) => (
          <line key={i} x1="100" y1="6" x2="100" y2={i % 5 === 0 ? 12 : 9} stroke="#2c3749" strokeWidth="1" transform={`rotate(${i * 6} 100 100)`} />
        ))}
        <circle
          cx="100"
          cy="100"
          r={R}
          stroke={state === 'win' ? '#35D07F' : state === 'loss' ? '#FF5570' : 'url(#dialg)'}
          strokeWidth="12"
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={`${arc} ${C}`}
          className={cn('transition-[stroke-dasharray,stroke] duration-500', state === 'spinning' && 'animate-pulse')}
        />
      </svg>
      <div ref={pointer} className="absolute inset-0 will-change-transform" style={{ transform: 'rotate(0deg)' }}>
        <div className="absolute top-[2%] left-1/2 h-[18%] w-1.5 -translate-x-1/2 rounded-full bg-text shadow-[0_0_14px_3px_rgba(255,255,255,0.7)]" />
        <div className="absolute top-[1%] left-1/2 size-3 -translate-x-1/2 rotate-45 bg-text" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="label text-[10px]">Шанс</div>
        <div className={cn('font-display text-4xl font-bold tnum', state === 'win' && 'text-success', state === 'loss' && 'text-danger')} data-testid="upgrade-chance">
          {chance === null ? '—' : `${chance.toFixed(2)}%`}
        </div>
        {state === 'win' && <div className="mt-1 text-sm font-bold text-success">Успех!</div>}
        {state === 'loss' && <div className="mt-1 text-sm font-bold text-danger">Неудача</div>}
      </div>
      {state === 'win' && <Particles />}
    </div>
  )
})

function Particles() {
  const parts = Array.from({ length: 22 }).map((_, i) => {
    const a = (i / 22) * Math.PI * 2
    const d = 90 + (i % 4) * 22
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, c: i % 3 === 0 ? '#00D4FF' : i % 3 === 1 ? '#35D07F' : '#7C5CFF', delay: (i % 5) * 40 }
  })
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {parts.map((p, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2 size-2 rounded-full"
          style={{ background: p.c, boxShadow: `0 0 8px ${p.c}`, ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, animation: `float-up 0.9s ${p.delay}ms ease-out forwards` }}
        />
      ))}
    </div>
  )
}
