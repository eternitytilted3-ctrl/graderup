import Image from 'next/image'
import Link from 'next/link'
import { formatMoney } from '@/lib/money'
import type { CaseDTO } from '@/lib/types'

export function CaseCard({ c, priority }: { c: CaseDTO; priority?: boolean }) {
  return (
    <Link
      href={`/cases/${c.slug}`}
      data-rarity={c.topRarity ?? 'epic'}
      className="group slot-bg relative flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-border transition-all duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_12px_30px_-12px_rgba(0,212,255,0.35)]"
    >
      <div className="relative flex h-40 items-center justify-center overflow-hidden sm:h-44">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_70%,rgb(124_92_255/0.16),transparent_70%)] transition-opacity group-hover:opacity-100" />
        <div className="absolute inset-x-6 bottom-3 h-6 rounded-[50%] bg-black/50 blur-md" />
        <Image
          src={c.image}
          alt={`Кейс ${c.name}`}
          width={200}
          height={160}
          priority={priority}
          className="relative h-32 w-auto max-w-[90%] object-contain transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:scale-105 sm:h-36"
        />
        {c.isFeatured && <span className="absolute top-3 left-3 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-accent uppercase">Hot</span>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.04] px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-display text-[17px] font-medium tracking-wide uppercase">{c.name}</div>
          <div className="text-xs text-muted">{c.itemCount ?? 0} предметов</div>
        </div>
        <span className="rounded-md bg-primary/12 px-2.5 py-1.5 font-display text-sm font-bold text-text tnum ring-1 ring-primary/30 transition group-hover:bg-primary group-hover:ring-primary">
          {formatMoney(c.price)}
        </span>
      </div>
    </Link>
  )
}
