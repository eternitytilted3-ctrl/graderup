'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages: (number | '…')[] = []
  const add = (p: number) => pages.push(p)
  add(1)
  if (page > 3) pages.push('…')
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) add(p)
  if (page < totalPages - 2) pages.push('…')
  if (totalPages > 1) add(totalPages)
  const btn = 'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm transition'
  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Пагинация">
      <button className={cn(btn, 'border-border text-muted hover:text-text disabled:opacity-40')} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Назад">
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1 text-subtle">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(btn, 'tnum', p === page ? 'border-primary/60 bg-primary/15 text-text' : 'border-border text-muted hover:text-text')}
          >
            {p}
          </button>
        ),
      )}
      <button className={cn(btn, 'border-border text-muted hover:text-text disabled:opacity-40')} disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Вперёд">
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}
