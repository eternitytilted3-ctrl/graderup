'use client'

import { Radio } from 'lucide-react'
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
}

/** Vertical live-drop rail (≥1280px). Polls every 8s, paused in hidden tabs. */
export function LiveSidebar() {
  const [drops, setDrops] = useState<Drop[]>([])
  const [online, setOnline] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (document.hidden) return
      try {
        const r = await api<{ items: Drop[]; online: number }>('/api/live')
        if (!alive) return
        setDrops(r.items)
        setOnline(r.online)
      } catch {}
    }
    void load()
    const id = setInterval(load, 8000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])
  return (
    <aside className="fixed top-16 bottom-0 left-0 z-30 hidden w-[220px] flex-col border-r border-border bg-[#0b0f15]/95 backdrop-blur xl:flex" aria-label="Последние дропы">
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <span className="font-display text-sm tracking-wider text-muted uppercase">Online</span>
        <span className="flex items-center gap-1.5 font-display text-[15px] font-semibold tnum">
          <Radio className="size-4 text-accent" />
          {online === null ? '—' : online.toLocaleString('ru-RU')}
        </span>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {drops.map((d) => {
          const [weapon, rest] = d.item.name.split(' | ')
          return (
            <li key={d.id} data-rarity={d.item.rarity} className="relative flex h-[70px] animate-fade-in items-center gap-3 border-b border-white/[0.04] px-3" title={`${d.username} · ${d.caseName} · ${formatMoney(d.item.price)}`}>
              <div className="slot-bg relative grid h-[54px] w-[68px] shrink-0 place-items-center overflow-hidden rounded-[3px]">
                <div className="absolute inset-0" style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--r) 30%, transparent), transparent)' }} />
                <Image src={d.item.image} alt="" width={200} height={140} className="relative h-9 w-auto" />
                <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: 'var(--r)' }} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-[13px] font-medium tracking-wide uppercase">{weapon}</div>
                <div className="truncate text-[11px] text-muted">{rest}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
