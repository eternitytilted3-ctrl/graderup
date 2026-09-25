'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { sfx } from '@/lib/sound'
import { cn } from '@/lib/cn'
import type { UpgradeBonusDTO } from '@/lib/types'

export type DialState = 'idle' | 'spinning' | 'win' | 'loss'

const CX = 150
const R_IN = 106 // liquid core
const R_RING = 132 // segmented ring (centre line)
const RING_W = 16
const SEGMENTS = 90

export interface UpgradeDialHandle {
  /**
   * Spins the needle and lands on the server roll (0..1). `win` = base win (needle inside the win arc);
   * a bonus-zone hit is a loss-range roll, so pass win=false for it.
   */
  spin: (rollFraction: number, opts?: { fast?: boolean; win?: boolean }) => Promise<void>
  reset: () => void
}

/** Point at clockwise angle `deg` from 6 o'clock (the needle's start). */
function at(deg: number, r: number) {
  const a = (deg * Math.PI) / 180
  return [CX - r * Math.sin(a), CX + r * Math.cos(a)] as const
}

/** Clockwise arc from `from`° to `to`° (from 6 o'clock). */
function arc(from: number, to: number, r: number) {
  const span = to - from
  if (span >= 359.99) return `M ${CX} ${CX + r} A ${r} ${r} 0 1 1 ${CX - 0.01} ${CX + r}`
  const [x1, y1] = at(from, r)
  const [x2, y2] = at(to, r)
  return `M ${x1} ${y1} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

/** Roll fraction → clockwise needle angle from 6 o'clock. Win arc = [-p·180°, p·180°]. */
export const rollToAngle = (roll: number, p: number) => ((((2 * roll - p) * 180) % 360) + 360) % 360

/**
 * GraderUP "reactor" gauge. The win arc is centred on 6 o'clock and the core fills from the bottom up
 * to the matching level (50% → half). The needle starts at the bottom and lands at (2·roll − p)·180°,
 * inside the arc exactly when roll < p — the server's result. An optional bonus zone (refund / ×2) is
 * drawn in the losing part where the server placed it. Visualization only (WAAPI).
 */
export const UpgradeDial = forwardRef<UpgradeDialHandle, { chance: number | null; state: DialState; bonus?: UpgradeBonusDTO | null }>(function UpgradeDial({ chance, state, bonus = null }, ref) {
  const needle = useRef<SVGGElement>(null)
  const anim = useRef<Animation | null>(null)
  const chanceRef = useRef(chance)
  useEffect(() => {
    chanceRef.current = chance
  }, [chance])

  useImperativeHandle(ref, () => ({
    reset() {
      anim.current?.cancel()
      anim.current = null
      if (needle.current) needle.current.style.transform = 'rotate(0deg)'
    },
    async spin(rollFraction: number, opts?: { fast?: boolean; win?: boolean }) {
      const el = needle.current
      if (!el) return
      anim.current?.cancel()
      const p = Math.min(1, Math.max(0, (chanceRef.current ?? 0) / 100))
      let theta = rollToAngle(rollFraction, p)
      if (theta > 180) theta -= 360 // signed, [-180, 180]
      // Display chance is rounded to 0.01%: keep the needle visibly on the side the server decided.
      const edge = p * 180
      if (opts?.win !== undefined) {
        const inside = Math.abs(theta) <= edge
        if (opts.win && !inside) theta = Math.sign(theta || 1) * Math.max(0, edge - 0.5)
        if (!opts.win && inside) theta = Math.sign(theta || 1) * Math.min(180, edge + 0.5)
      }
      const end = (opts?.fast ? 2 : 8) * 360 + (((theta % 360) + 360) % 360)
      sfx.upgradeStart()
      const a = el.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${end}deg)` }], {
        duration: opts?.fast ? 1200 : 7500,
        easing: 'cubic-bezier(0.1, 0.75, 0.08, 1)',
        fill: 'forwards',
      })
      anim.current = a
      let lastStep = 0
      let raf = 0
      const loop = () => {
        const progress = a.effect?.getComputedTiming().progress ?? 0
        const step = Math.floor((end * progress) / (360 / SEGMENTS) / 2)
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
  const accent = tone === 'win' ? '#35D07F' : tone === 'loss' ? '#FF5570' : '#00D4FF'
  const label = chance === null ? 'Выберите предметы' : pct < 30 ? 'Низкий шанс' : pct < 60 ? 'Средний шанс' : 'Высокий шанс'
  const edge = p * 180

  const bz =
    bonus && chance !== null
      ? {
          from: rollToAngle(bonus.start, p),
          to: rollToAngle(bonus.start + bonus.size, p),
          ...bonus,
        }
      : null
  const bzColor = bz?.type === 'double' ? '#ff4fd8' : '#ffc93c'
  const bzMid = bz ? (bz.from + (bz.to < bz.from ? bz.to + 360 : bz.to)) / 2 : 0
  // Badge sits inside the core, pointing at the zone (keeps the ring arc itself visible).
  const [bx, by] = bz ? at(bzMid, R_IN - 22) : [0, 0]
  const [lx1, ly1] = bz ? at(bzMid, R_IN - 6) : [0, 0]
  const [lx2, ly2] = bz ? at(bzMid, R_RING - RING_W / 2 - 1) : [0, 0]

  return (
    <div className={cn('relative aspect-square w-full max-w-[340px] select-none', state === 'loss' && !bonus?.hit && 'animate-[shake_0.5s_ease-in-out]')} data-state={state}>
      <style>{`
        @keyframes shake{0%,100%{transform:none}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
        @keyframes ud-wave{from{transform:translateX(0)}to{transform:translateX(-80px)}}
        @keyframes ud-bubble{0%{transform:translateY(0);opacity:0}15%{opacity:.7}100%{transform:translateY(-120px);opacity:0}}
        @keyframes ud-orbit{to{transform:rotate(360deg)}}
        @keyframes ud-pop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.25);opacity:1}100%{transform:scale(1)}}
        @keyframes ud-pulse{0%,100%{opacity:1}50%{opacity:.45}}
      `}</style>
      <svg viewBox="0 0 300 300" className="size-full overflow-visible">
        <defs>
          <linearGradient id="ud-liq-base" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8e72ff" />
            <stop offset="1" stopColor="#00b8e6" />
          </linearGradient>
          <linearGradient id="ud-liq-win" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5ff09e" />
            <stop offset="1" stopColor="#127a41" />
          </linearGradient>
          <linearGradient id="ud-liq-loss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff7086" />
            <stop offset="1" stopColor="#8f1027" />
          </linearGradient>
          <linearGradient id="ud-arc" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#7C5CFF" />
            <stop offset="1" stopColor="#00D4FF" />
          </linearGradient>
          <radialGradient id="ud-core" cx="0.5" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#1c2230" />
            <stop offset="1" stopColor="#0b0e14" />
          </radialGradient>
          <clipPath id="ud-clip">
            <circle cx={CX} cy={CX} r={R_IN} />
          </clipPath>
          <filter id="ud-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* housing */}
        <circle cx={CX} cy={CX} r={149} fill="#0b0e14" stroke="#202938" strokeWidth="2" />
        <circle cx={CX} cy={CX} r={R_RING} fill="none" stroke="#161c27" strokeWidth={RING_W} />

        {/* win arc (exact), bonus zone, then segment gaps cut on top of everything */}
        {chance !== null && (
          <>
            <path d={arc(-edge, edge, R_RING)} stroke={tone === 'base' ? 'url(#ud-arc)' : accent} strokeWidth={RING_W} fill="none" className="transition-[stroke] duration-500" />
            <path d={arc(-edge, edge, R_RING)} stroke={accent} strokeWidth={RING_W} fill="none" opacity={0.45} filter="url(#ud-glow)" />
          </>
        )}
        {bz && (
          <g
            style={{
              animation: 'ud-pop .45s cubic-bezier(.2,.9,.3,1.3) both',
              transformOrigin: `${bx}px ${by}px`,
              transformBox: 'view-box',
            }}
          >
            <path d={arc(bz.from, bz.to < bz.from ? bz.to + 360 : bz.to, R_RING)} stroke={bzColor} strokeWidth={RING_W} fill="none" />
            <path d={arc(bz.from, bz.to < bz.from ? bz.to + 360 : bz.to, R_RING)} stroke={bzColor} strokeWidth={RING_W + 6} fill="none" opacity={0.5} filter="url(#ud-glow)" style={bz.hit && state !== 'spinning' ? { animation: 'ud-pulse .8s ease-in-out infinite' } : undefined} />
          </g>
        )}
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <line key={i} x1={CX} y1={CX + R_RING - RING_W / 2 - 1} x2={CX} y2={CX + R_RING + RING_W / 2 + 1} stroke="#0b0e14" strokeWidth="1.6" transform={`rotate(${(i * 360) / SEGMENTS} ${CX} ${CX})`} />
        ))}

        {/* core with bottom-up liquid */}
        <circle cx={CX} cy={CX} r={R_IN + 5} fill="#10141c" stroke="#202938" strokeWidth="1.5" />
        <circle cx={CX} cy={CX} r={R_IN} fill="url(#ud-core)" />
        <g clipPath="url(#ud-clip)">
          <g
            className="transition-transform duration-700 ease-out"
            style={{
              transform: `translateY(${chance === null ? 300 : level - 6}px)`,
            }}
          >
            <g style={{ animation: 'ud-wave 2.4s linear infinite' }}>
              <path d={`M-40 6 ${Array.from({ length: 6 }, () => `q20 -6 40 0 t40 0`).join(' ')} V320 H-40 Z`} fill={`url(#ud-liq-${tone})`} opacity={0.55} transform="translate(0 -3)" />
            </g>
            <g style={{ animation: 'ud-wave 3.6s linear infinite reverse' }}>
              <path d={`M-40 6 ${Array.from({ length: 6 }, () => `q20 5 40 0 t40 0`).join(' ')} V320 H-40 Z`} fill={`url(#ud-liq-${tone})`} />
            </g>
            {[40, 78, 120, 170, 212, 250].map((x, i) => (
              <circle
                key={x}
                cx={x}
                cy={70 + (i % 3) * 30}
                r={1.6 + (i % 3)}
                fill="#fff"
                fillOpacity={0.35}
                style={{
                  animation: `ud-bubble ${2.6 + i * 0.4}s ${i * 0.5}s ease-in infinite`,
                }}
              />
            ))}
          </g>
        </g>

        {/* centre glass */}
        <circle cx={CX} cy={CX} r={64} fill="#0b0e14" fillOpacity={0.78} stroke="#fff" strokeOpacity={0.08} />
        <g
          style={{
            transformOrigin: `${CX}px ${CX}px`,
            transformBox: 'view-box',
            animation: `ud-orbit ${state === 'spinning' ? 1.2 : 14}s linear infinite`,
          }}
        >
          <circle cx={CX} cy={CX} r={71} fill="none" stroke={accent} strokeOpacity={0.55} strokeWidth="1.5" strokeDasharray="3 9" className="transition-[stroke] duration-500" />
        </g>
        <path d={`M${CX} ${CX - 40} L${CX + 22} ${CX - 16} H${CX + 9} V${CX + 26} H${CX - 9} V${CX - 16} H${CX - 22} Z`} fill={accent} fillOpacity={0.08} className="transition-[fill] duration-500" />

        {/* bonus badge */}
        {bz && (
          <g
            style={{
              animation: 'ud-pop .5s .1s cubic-bezier(.2,.9,.3,1.3) both',
              transformOrigin: `${bx}px ${by}px`,
              transformBox: 'view-box',
            }}
          >
            <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={bzColor} strokeWidth="2" strokeDasharray="2 3" />
            <circle cx={bx} cy={by} r={15} fill="#0b0e14" stroke={bzColor} strokeWidth="2.5" />
            {bz.type === 'double' ? (
              <text x={bx} y={by + 0.5} textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-display)" fontWeight={800} fontSize="13" fill={bzColor}>
                ×2
              </text>
            ) : (
              <g fill={bzColor}>
                <ellipse cx={bx} cy={by + 5} rx={7.5} ry={2.6} />
                <rect x={bx - 7.5} y={by + 1} width={15} height={4} />
                <ellipse cx={bx} cy={by + 1} rx={7.5} ry={2.6} fill="#fff3c4" />
                <ellipse cx={bx} cy={by - 3} rx={7.5} ry={2.6} />
                <rect x={bx - 7.5} y={by - 7} width={15} height={4} />
                <ellipse cx={bx} cy={by - 7} rx={7.5} ry={2.6} fill="#fff3c4" />
              </g>
            )}
          </g>
        )}

        {/* needle: starts at 6 o'clock, sweeps across the ring */}
        <g
          ref={needle}
          style={{
            transform: 'rotate(0deg)',
            transformOrigin: `${CX}px ${CX}px`,
            transformBox: 'view-box',
          }}
          className="will-change-transform"
        >
          <rect x={CX - 3} y={CX + R_RING - RING_W / 2 - 7} width={6} height={RING_W + 14} rx={3} fill="#fff" filter="url(#ud-glow)" opacity={0.9} />
          <rect x={CX - 2} y={CX + R_RING - RING_W / 2 - 6} width={4} height={RING_W + 12} rx={2} fill="#fff" />
          <path d={`M${CX} ${CX + R_IN + 2} L${CX + 6} ${CX + R_RING - RING_W / 2 - 5} H${CX - 6} Z`} fill="#fff" />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className={cn('font-display text-[42px] leading-none font-bold text-white tnum drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]', state === 'win' && 'text-success', state === 'loss' && 'text-danger')} data-testid="upgrade-chance">
          {chance === null ? '—' : `${chance.toFixed(2)}%`}
        </div>
        <div className="mt-1.5 text-[13px] font-semibold tracking-wide text-white/85 uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {bonus?.hit && state !== 'spinning' ? (
            <span style={{ color: bzColor }}>{bonus.type === 'double' ? 'Бонус ×2!' : 'Страховка!'}</span>
          ) : state === 'win' ? (
            <span className="text-success">Успех!</span>
          ) : state === 'loss' ? (
            <span className="text-danger">Неудача</span>
          ) : bonus && state === 'spinning' ? (
            <span style={{ color: bzColor }}>{bonus.type === 'double' ? 'Появилась зона ×2' : 'Появилась страховка'}</span>
          ) : (
            label
          )}
        </div>
      </div>
      {(state === 'win' || bonus?.hit) && state !== 'spinning' && <Particles colors={bonus?.hit ? [bzColor, '#fff', bzColor] : ['#00D4FF', '#35D07F', '#7C5CFF']} />}
    </div>
  )
})

function Particles({ colors }: { colors: string[] }) {
  const parts = Array.from({ length: 24 }).map((_, i) => {
    const a = (i / 24) * Math.PI * 2
    const d = 110 + (i % 4) * 24
    return {
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d,
      c: colors[i % colors.length],
      delay: (i % 5) * 40,
    }
  })
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {parts.map((p, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2 size-2 rounded-full"
          style={{
            background: p.c,
            boxShadow: `0 0 8px ${p.c}`,
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            animation: `float-up 0.9s ${p.delay}ms ease-out forwards`,
          }}
        />
      ))}
    </div>
  )
}
