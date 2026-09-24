'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import type { ItemDTO } from '@/lib/types'

interface Drop {
  id: string
  username: string
  caseName: string
  item: ItemDTO
  createdAt: string
}

/** Horizontal live feed of recent drops (polls every 8s, pauses when the tab is hidden). */
export function LiveDrops({ initial }: { initial: Drop[] }) {
  const [drops, setDrops] = useState(initial)
  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (document.hidden) return
      try {
        const r = await api<{ items: Drop[] }>('/api/live')
        if (alive) setDrops(r.items)
      } catch {
        /* keep previous */
      }
    }
    const id = setInterval(tick, 8000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])
  if (drops.length === 0) return null
  return (
    <div className="relative">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [mask-image:linear-gradient(90deg,#000_85%,transparent)]">
        <span className="flex shrink-0 items-center gap-2 pr-2 text-xs font-semibold tracking-wider text-muted uppercase">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Live
        </span>
        {drops.map((d) => (
          <div
            key={d.id}
            data-rarity={d.item.rarity}
            title={`${d.username} · ${d.caseName}`}
            className="relative flex h-14 w-40 shrink-0 animate-fade-in items-center gap-2 overflow-hidden rounded-md border border-border bg-card px-2"
          >
            <span className="absolute inset-y-0 left-0 w-0.5" style={{ background: 'var(--r)' }} />
            <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(60% 90% at 20% 50%, color-mix(in srgb, var(--r) 30%, transparent), transparent)' }} />
            <Image src={d.item.image} alt="" width={48} height={34} className="relative h-8 w-12 object-contain" />
            <div className="relative min-w-0">
              <div className="truncate text-[11px] font-semibold">{d.item.name.split(' | ')[0]}</div>
              <div className="truncate text-[10px] text-muted">
                {d.username} · <span className="text-text tnum">{formatMoney(d.item.price)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
