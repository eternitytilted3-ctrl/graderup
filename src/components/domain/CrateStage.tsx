'use client'

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { Crate3D, has3D } from './Crate3D'

export type CratePhase = 'idle' | 'opening' | 'spinning' | 'done'

/** Shake before the crate evaporates (ms); the dissolve itself lasts DISSOLVE_MS. */
export const SHAKE_MS = 420
export const DISSOLVE_MS = 1050
export const FAST_DISSOLVE_MS = 380
export const openingDuration = (fast: boolean) => (fast ? FAST_DISSOLVE_MS : SHAKE_MS + DISSOLVE_MS)

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  start: number
  size: number
  r: number
  g: number
  b: number
  spark: boolean
}

/**
 * Pixel-dissolve: the crate's own pixels break off in a left→right / bottom→top sweep, drift up and
 * fade out like vapour, with a few bright sparks. Canvas 2D, ~4k particles, runs once per opening.
 * Falls back to a CSS fade if the image cannot be read (e.g. a cross-origin custom image).
 */
function dissolve(img: HTMLImageElement, canvas: HTMLCanvasElement, duration: number) {
  return new Promise<void>((resolve) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // Visual box of the (possibly CSS-translated) image, relative to the canvas' positioned parent.
    const r = img.getBoundingClientRect()
    const pr = (canvas.offsetParent ?? canvas.parentElement!).getBoundingClientRect()
    const w = Math.round(r.width)
    const h = Math.round(r.height)
    const pad = Math.round(h * 0.6) // room for particles to rise above the crate
    canvas.width = Math.round((w + pad) * dpr)
    canvas.height = Math.round((h + pad) * dpr)
    canvas.style.width = `${w + pad}px`
    canvas.style.height = `${h + pad}px`
    canvas.style.left = `${r.left - pr.left - pad / 2}px`
    canvas.style.top = `${r.top - pr.top - pad}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return resolve()

    // Sample the crate at display size.
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const octx = off.getContext('2d', { willReadFrequently: true })
    let data: Uint8ClampedArray
    try {
      octx!.drawImage(img, 0, 0, w, h)
      data = octx!.getImageData(0, 0, w, h).data
    } catch {
      return resolve()
    }
    const step = Math.max(2, Math.round(Math.sqrt((w * h) / 4200)))
    const parts: Particle[] = []
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4
        if (data[i + 3] < 60) continue
        // Sweep: starts at the lower-left, runs to the upper-right; a little noise keeps the edge ragged.
        const start = (x / w) * 0.5 + (1 - y / h) * 0.18 + Math.random() * 0.12
        parts.push({
          x: x + pad / 2,
          y: y + pad,
          vx: 8 + Math.random() * 45,
          vy: -(80 + Math.random() * 170),
          start,
          size: step * (0.8 + Math.random() * 0.5),
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
          spark: Math.random() < 0.04,
        })
      }
    }

    const t0 = performance.now()
    const life = 0.42 // share of the timeline a particle lives after breaking off
    const frame = (now: number) => {
      const t = (now - t0) / duration
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w + pad, h + pad)
      // The intact part stays the crisp original image; broken-off cells are cut out of it.
      ctx.globalAlpha = 1
      ctx.drawImage(img, pad / 2, pad, w, h)
      for (const p of parts) if (t > p.start) ctx.clearRect(p.x - 0.5, p.y - 0.5, step + 1, step + 1)
      for (const p of parts) {
        const local = (t - p.start) / life
        if (local <= 0 || local >= 1) continue
        const secs = local * life * (duration / 1000)
        // Heats up (brightens towards cyan-white) and fades as it rises.
        const heat = Math.min(1, local * 1.6)
        const r = p.r + (200 - p.r) * heat
        const g = p.g + (240 - p.g) * heat
        const b = p.b + (255 - p.b) * heat
        ctx.globalAlpha = (1 - local) * (p.spark ? 1 : 0.85)
        ctx.fillStyle = p.spark ? '#e9fbff' : `rgb(${r | 0},${g | 0},${b | 0})`
        const s = p.size * (1 - local * 0.6) * (p.spark ? 1.4 : 1)
        ctx.fillRect(p.x + p.vx * secs + Math.sin((p.start + local) * 12) * 3, p.y + p.vy * secs - 40 * secs * secs, s, s)
      }
      ctx.globalAlpha = 1
      if (t < 1 + life) requestAnimationFrame(frame)
      else {
        ctx.clearRect(0, 0, w + pad, h + pad)
        resolve()
      }
    }
    requestAnimationFrame(frame)
  })
}

/** Crate on its pedestal: idle float → (opening) shake, then evaporates into particles. */
export function CrateStage({ image, name, phase, fast }: { image: string; name: string; phase: CratePhase; fast: boolean }) {
  const img = useRef<HTMLImageElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [step, setStep] = useState<'idle' | 'shake' | 'vapour' | 'gone'>('idle')

  useEffect(() => {
    if (phase !== 'opening') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep('idle')
      return
    }
    let cancelled = false
    const run = async () => {
      if (!fast) {
        setStep('shake')
        await new Promise((r) => setTimeout(r, SHAKE_MS))
      }
      if (cancelled || !img.current || !canvas.current) return
      setStep('vapour')
      await dissolve(img.current, canvas.current, fast ? FAST_DISSOLVE_MS * 0.7 : DISSOLVE_MS * 0.7)
      if (!cancelled) setStep('gone')
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [phase, fast])

  return (
    <div className="crate-stage relative flex h-60 items-center justify-center overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-2 sm:h-72" data-phase={phase}>
      <div className={cn('crate-rays pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[140%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500', step === 'vapour' || step === 'gone' ? 'opacity-0' : 'opacity-100')} />
      <div className={cn('crate-core-glow pointer-events-none absolute top-1/2 left-1/2 size-64 rounded-full', step === 'vapour' && 'crate-core-glow-on')} />
      <div className="relative w-[300px] sm:w-[380px]">
        <Crate3D image={image} alt={`Кейс ${name}`} still={step !== 'idle'} className={cn(step === 'shake' && 'crate-shake', (step === 'vapour' || step === 'gone') && 'invisible')} />
        {/* Flat 3/4 render of the same crate, used as the pixel source for the dissolve. */}
        <img ref={img} src={image} alt="" aria-hidden draggable={false} className={cn('pointer-events-none invisible absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2', has3D(image) ? 'w-[102%]' : 'w-[88%]')} />
        <canvas ref={canvas} className="pointer-events-none absolute" aria-hidden />
      </div>
    </div>
  )
}
