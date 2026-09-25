'use client'

import { Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

const pad = (n: number) => String(n).padStart(2, '0')

/** "20Д:13Ч:58М" (or "13Ч:58М:07С" in the last day) until `endsAt`. */
export function formatLeft(ms: number) {
  if (ms <= 0) return 'Завершён'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d > 0 ? `${d}Д:${pad(h)}Ч:${pad(m)}М` : `${pad(h)}Ч:${pad(m)}М:${pad(s % 60)}С`
}

export function Countdown({ endsAt, className }: { endsAt: string; className?: string }) {
  const end = new Date(endsAt).getTime()
  const [now, setNow] = useState(() => Date.now())
  const left = end - now
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), left < 86_400_000 ? 1000 : 30_000)
    return () => clearInterval(t)
  }, [left])
  return (
    <span className={cn('inline-flex items-center gap-1 font-display font-semibold tracking-wide tnum', className)} suppressHydrationWarning>
      <Clock className="size-[1.05em]" strokeWidth={2.5} />
      {formatLeft(left)}
    </span>
  )
}
