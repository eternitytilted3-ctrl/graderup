import Image from 'next/image'
import Link from 'next/link'
import { CoinAmount } from '@/components/ui/Coin'
import { cn } from '@/lib/cn'
import type { CaseBadge, CaseDTO } from '@/lib/types'
import { Countdown } from './Countdown'

const BADGE: Record<CaseBadge, { label: string; cls: string }> = {
  limited: { label: 'Limited', cls: 'bg-[#ff4d5e] text-white' },
  new: { label: 'New', cls: 'bg-success text-[#06210f]' },
  hot: { label: 'Hot', cls: 'bg-[#ff8a1f] text-[#2a1200]' },
}

export function CaseCard({ c, priority }: { c: CaseDTO; priority?: boolean }) {
  const badge = c.badge ? BADGE[c.badge] : null
  return (
    <Link
      href={`/cases/${c.slug}`}
      data-rarity={c.topRarity ?? 'epic'}
      className="case-card group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-white/[0.06] transition-all duration-200 hover:-translate-y-1 hover:ring-white/20"
    >
      <div className="relative flex aspect-[5/4] items-center justify-center">
        <div className="absolute inset-x-[14%] bottom-[9%] h-[12%] rounded-[50%] bg-black/45 blur-md transition-transform duration-300 group-hover:scale-90" />
        <Image
          src={c.image}
          alt={`Кейс ${c.name}`}
          width={260}
          height={200}
          priority={priority}
          className="relative w-[88%] object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-[1.04]"
        />
        {badge && <span className={cn('absolute top-2.5 left-2.5 rounded-[3px] px-2 py-0.5 font-display text-[13px] font-bold tracking-wide uppercase shadow-md', badge.cls)}>{badge.label}</span>}
        {c.endsAt && <Countdown endsAt={c.endsAt} className="absolute top-2.5 right-2.5 text-[13px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />}
      </div>
      <div className="relative px-3.5 pt-0.5 pb-3.5">
        <div className="truncate text-[17px] leading-tight font-bold text-white">{c.name}</div>
        <CoinAmount value={c.price} className="mt-1.5 text-[15px] font-bold text-white" />
      </div>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] opacity-70 transition-opacity group-hover:opacity-100" style={{ background: 'var(--r)' }} />
    </Link>
  )
}
