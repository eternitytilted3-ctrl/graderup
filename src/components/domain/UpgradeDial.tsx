'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { sfx } from '@/lib/sound'
import { cn } from '@/lib/cn'

export type DialState = 'idle' | 'spinning' | 'win' | 'loss'

const CX = 150
const R_IN = 112 // "liquid" disc
const R_ARC = 114.5 // win arc on the disc rim
const R_LBL = 122 // 0/50/100% marks on the dark ring
const R_PTR = 136 // pointer track

export interface UpgradeDialHandle {
  /** Spins the pointer and lands on the server roll (0..1). `win` keeps the landing on the right side of the edge. */
  spin: (rollFraction: number, opts?: { fast?: boolean; win?: boolean }) => Promise<void>
  reset: () => void
}

/**
 * Chance gauge. The win zone is filled from the bottom up: chance p covers the arc ±p·180° around
 * 6 o'clock, so the "liquid" level sits at height −cos(p·π) (50% → half, 100% → full).
 * The pointer starts at the bottom and lands at angle (2·roll − p)·180° from it, which is inside
 * the zone exactly when roll < p — i.e. when the server says "win". Visualization only (WAAPI).
 */
export const UpgradeDial = forwardRef<UpgradeDialHandle, { chance: number | null; state: DialState }>(function UpgradeDial({ chance, state }, ref) {
  const pointer = useRef<SVGGElement>(null)
  const anim = useRef<Animation | null>(null)
  const chanceRef = useRef(chance)
  useEffect(() => {
    chanceRef.current = chance
  }, [chance])

  useImperativeHandle(ref, () => ({
    reset() {
      anim.current?.cancel()
      anim.current = null
      if (pointer.current) pointer.current.style.transform = 'rotate(0deg)'
    },
    async spin(rollFraction: number, opts?: { fast?: boolean; win?: boolean }) {
      const el = pointer.current
      if (!el) return
      anim.current?.cancel()
      const p = Math.min(1, Math.max(0, (chanceRef.current ?? 0) / 100))
      let theta = (2 * rollFraction - p) * 180 // degrees from 6 o'clock, zone = [-p·180, p·180]
      // Display chance is rounded to 0.01%: keep the needle visibly on the side the server decided.
      const edge = p * 180
      if (opts?.win !== undefined) {
        const inside = Math.abs(theta) <= edge
        if (opts.win && !inside) theta = Math.sign(theta || 1) * Math.max(0, edge - 0.5)
        if (!opts.win && inside) theta = Math.sign(theta || 1) * Math.min(180, edge + 0.5)
      }
      const end = (opts?.fast ? 2 : 5) * 360 + ((theta % 360) + 360) % 360
      sfx.upgradeStart()
      const a = el.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${end}deg)` }], {
        duration: opts?.fast ? 1100 : 4200,
        easing: 'cubic-bezier(0.12, 0.72, 0.1, 1)',
        fill: 'forwards',
      })
      anim.current = a
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

  const pct = Math.min(100, Math.max(0, chance ?? 0))
  const p = pct / 100
  const level = CX + R_IN * Math.cos(p * Math.PI) // y of the liquid surface
  const tone = state === 'win' ? 'win' : state === 'loss' ? 'loss' : 'base'
  const label = chance === null ? 'Выберите предметы' : pct < 30 ? 'Низкий шанс' : pct < 60 ? 'Средний шанс' : 'Высокий шанс'
  // Win arc on the bezel: from angle -p·π to +p·π around the bottom.
  const arcPt = (a: number) => [CX + R_ARC * Math.sin(a), CX + R_ARC * Math.cos(a)]
  const [ax1, ay1] = arcPt(-p * Math.PI)
  const [ax2, ay2] = arcPt(p * Math.PI)
  const arcPath = p >= 0.9999 ? `M ${CX} ${CX + R_ARC} A ${R_ARC} ${R_ARC} 0 1 1 ${CX - 0.01} ${CX + R_ARC}` : `M ${ax1} ${ay1} A ${R_ARC} ${R_ARC} 0 ${p > 0.5 ? 1 : 0} 0 ${ax2} ${ay2}`

  return (
    <div className={cn('relative aspect-square w-full max-w-[340px] select-none', state === 'loss' && 'animate-[shake_0.5s_ease-in-out]')} data-state={state}>
      <style>{`@keyframes shake{0%,100%{transform:none}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}`}</style>
      <svg viewBox="0 0 300 300" className="size-full overflow-visible">
        <defs>
          <linearGradient id="ud-liquid-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff9d1c" />
            <stop offset="0.6" stopColor="#e2680a" />
            <stop offset="1" stopColor="#9a3600" />
          </linearGradient>
          <linearGradient id="ud-liquid-win" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5ff09e" />
            <stop offset="1" stopColor="#157a44" />
          </linearGradient>
          <linearGradient id="ud-liquid-loss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff7086" />
            <stop offset="1" stopColor="#8f1027" />
          </linearGradient>
          <linearGradient id="ud-bezel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5b6068" />
            <stop offset="1" stopColor="#2b2e34" />
          </linearGradient>
          <linearGradient id="ud-ptr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd35a" />
            <stop offset="1" stopColor="#ff6a00" />
          </linearGradient>
          <radialGradient id="ud-disc" cx="0.5" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#2a2d33" />
            <stop offset="1" stopColor="#141619" />
          </radialGradient>
          <clipPath id="ud-clip">
            <circle cx={CX} cy={CX} r={R_IN} />
          </clipPath>
        </defs>

        {/* bezel + ticks */}
        <circle cx={CX} cy={CX} r={146} fill="url(#ud-bezel)" />
        <circle cx={CX} cy={CX} r={131} fill="#1b1d21" />
        {Array.from({ length: 72 }).map((_, i) => {
          const major = i % 9 === 0
          return <line key={i} x1={CX} y1={CX - 146} x2={CX} y2={CX - (major ? 137 : 141)} stroke="#fff" strokeOpacity={major ? 0.55 : 0.22} strokeWidth={major ? 1.6 : 1} transform={`rotate(${i * 5} ${CX} ${CX})`} />
        })}
        
        {/* disc with bottom-up liquid */}
        <circle cx={CX} cy={CX} r={R_IN} fill="url(#ud-disc)" />
        <g clipPath="url(#ud-clip)">
          <g className="transition-transform duration-700 ease-out" style={{ transform: `translateY(${chance === null ? 300 : level}px)` }}>
            <rect x="0" y="0" width="300" height="300" fill={`url(#ud-liquid-${tone})`} />
            <rect x="0" y="0" width="300" height="3" fill="#fff" fillOpacity={0.35} />
            <rect x="0" y="3" width="300" height="10" fill="#000" fillOpacity={0.12} />
          </g>
          <circle cx={CX} cy={CX} r={R_IN} fill="none" stroke="#000" strokeOpacity={0.45} strokeWidth="10" />
        </g>
        <circle cx={CX} cy={CX} r={R_IN} fill="none" stroke="#fff" strokeOpacity={0.08} />
        <path d={arcPath} stroke={tone === 'win' ? '#35D07F' : tone === 'loss' ? '#FF5570' : '#ffb13d'} strokeWidth="5" fill="none" strokeLinecap="butt" className="transition-[stroke] duration-500" opacity={chance === null ? 0 : 1} />

        {/* 0 / 50 / 100 marks */}
        <g fontFamily="var(--font-display)" fontWeight={700} fontSize="9.5" fill="#fff" fillOpacity={0.5} textAnchor="middle" dominantBaseline="central">
          <text x={CX} y={CX - R_LBL}>100%</text>
          <text x={CX - R_LBL} y={CX} transform={`rotate(-90 ${CX - R_LBL} ${CX})`}>50%</text>
          <text x={CX + R_LBL} y={CX} transform={`rotate(90 ${CX + R_LBL} ${CX})`}>50%</text>
          <text x={CX} y={CX + R_LBL}>0%</text>
        </g>

        {/* centre emblem (original: hexagon + up-arrows) */}
        <circle cx={CX} cy={CX} r={70} fill="#15171b" fillOpacity={0.82} stroke="#fff" strokeOpacity={0.07} strokeWidth="2" />
        <g opacity={0.9} stroke={tone === 'win' ? '#35D07F' : tone === 'loss' ? '#FF5570' : '#ff8a1f'} fill="none" strokeLinejoin="round" className="transition-[stroke] duration-500">
          <path d={hexPath(CX, CX, 54)} strokeWidth="3" />
          <path d={hexPath(CX, CX, 46)} strokeWidth="1.2" strokeOpacity={0.6} />
          <path d={`M${CX - 26} ${CX + 12} L${CX} ${CX - 14} L${CX + 26} ${CX + 12}`} strokeWidth="7" strokeOpacity={0.35} />
          <path d={`M${CX - 20} ${CX + 30} L${CX} ${CX + 10} L${CX + 20} ${CX + 30}`} strokeWidth="6" strokeOpacity={0.25} />
        </g>

        {/* pointer: starts at 6 o'clock, rotates around the centre */}
        <g ref={pointer} style={{ transform: 'rotate(0deg)', transformOrigin: `${CX}px ${CX}px`, transformBox: 'view-box' }} className="will-change-transform">
          <path d={`M${CX} ${CX + R_PTR - 16} L${CX + 12} ${CX + R_PTR + 6} L${CX} ${CX + R_PTR + 1} L${CX - 12} ${CX + R_PTR + 6} Z`} fill="url(#ud-ptr)" stroke="#2a1200" strokeWidth="1.5" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(255,140,30,.8))' }} />
          <path d={`M${CX} ${CX + R_PTR - 12} L${CX + 5} ${CX + R_PTR}`} stroke="#fff" strokeOpacity={0.6} strokeWidth="1.2" />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className={cn('font-display text-[44px] leading-none font-bold text-white tnum drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]', state === 'win' && 'text-success', state === 'loss' && 'text-danger')} data-testid="upgrade-chance">
          {chance === null ? '—' : `${chance.toFixed(2)}%`}
        </div>
        <div className="mt-1.5 text-sm font-semibold text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          {state === 'win' ? <span className="text-success">Успех!</span> : state === 'loss' ? <span className="text-danger">Неудача</span> : label}
        </div>
      </div>
      {state === 'win' && <Particles />}
    </div>
  )
})

function hexPath(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  })
  return `M${pts.join(' L')} Z`
}

function Particles() {
  const parts = Array.from({ length: 22 }).map((_, i) => {
    const a = (i / 22) * Math.PI * 2
    const d = 110 + (i % 4) * 24
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, c: i % 3 === 0 ? '#ffb547' : i % 3 === 1 ? '#35D07F' : '#ff8a1f', delay: (i % 5) * 40 }
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
