'use client'

import { useEffect, useRef } from 'react'

/**
 * Upgrade win effect (canvas, ~2.4s): light flash, expanding shock rings, rotating light rays
 * and a burst of rarity-coloured "shards" that fly out and fall with gravity and spin.
 * Pure decoration; pointer-events: none; respects the caller's lifetime.
 */
export function WinCelebration({ origin, color = '#35d07f', onDone }: { origin: { x: number; y: number }; color?: string; onDone?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = window.innerWidth
    const H = window.innerHeight
    c.width = W * dpr
    c.height = H * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    const palette = [color, '#ffffff', '#ffd76a', '#00d4ff', color]
    const shards = Array.from({ length: 90 }, (_, i) => {
      const a = (i / 90) * Math.PI * 2 + Math.random() * 0.3
      const v = 6 + Math.random() * 9
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 4,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        w: 4 + Math.random() * 7,
        h: 2 + Math.random() * 4,
        color: palette[i % palette.length],
        diamond: i % 3 === 0,
      }
    })
    const start = performance.now()
    const DURATION = 2400
    let raf = 0
    const frame = (now: number) => {
      const t = (now - start) / DURATION
      ctx.clearRect(0, 0, W, H)
      if (t >= 1) {
        onDone?.()
        return
      }
      // Flash
      if (t < 0.18) {
        const g = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, 420)
        g.addColorStop(0, `rgba(255,255,255,${0.55 * (1 - t / 0.18)})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
      }
      // Rotating light rays
      ctx.save()
      ctx.translate(origin.x, origin.y)
      ctx.rotate(t * 1.6)
      const rayAlpha = Math.max(0, 0.28 * (1 - t))
      for (let i = 0; i < 14; i++) {
        ctx.rotate((Math.PI * 2) / 14)
        const grad = ctx.createLinearGradient(0, 0, 0, -520)
        grad.addColorStop(0, hexA(color, rayAlpha))
        grad.addColorStop(1, hexA(color, 0))
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(-10, 0)
        ctx.lineTo(10, 0)
        ctx.lineTo(46, -520)
        ctx.lineTo(-46, -520)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
      // Shock rings
      for (let k = 0; k < 3; k++) {
        const rt = t * 1.6 - k * 0.14
        if (rt <= 0 || rt >= 1) continue
        ctx.beginPath()
        ctx.arc(origin.x, origin.y, 40 + rt * 360, 0, Math.PI * 2)
        ctx.strokeStyle = hexA(k === 1 ? '#ffffff' : color, 0.7 * (1 - rt))
        ctx.lineWidth = 6 * (1 - rt) + 1
        ctx.stroke()
      }
      // Shards
      for (const s of shards) {
        s.vy += 0.28
        s.vx *= 0.985
        s.x += s.vx
        s.y += s.vy
        s.r += s.vr
        ctx.save()
        ctx.globalAlpha = Math.max(0, 1 - t * 1.05)
        ctx.translate(s.x, s.y)
        ctx.rotate(s.r)
        ctx.fillStyle = s.color
        if (s.diamond) {
          ctx.beginPath()
          ctx.moveTo(0, -s.w)
          ctx.lineTo(s.h, 0)
          ctx.lineTo(0, s.w)
          ctx.lineTo(-s.h, 0)
          ctx.closePath()
          ctx.fill()
        } else ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h)
        ctx.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [origin, color, onDone])
  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-[150] h-full w-full" aria-hidden data-testid="win-celebration" />
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`
}
