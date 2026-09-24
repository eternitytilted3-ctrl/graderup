'use client'

import { cn } from '@/lib/cn'

export interface FilterOption<T extends string> {
  value: T
  label: string
  color?: string
}

/** Horizontal chip filter; scrolls on small screens. */
export function Filter<T extends string>({ options, value, onChange, ariaLabel }: { options: FilterOption<T>[]; value: T; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
            value === o.value ? 'border-primary/60 bg-primary/15 text-text' : 'border-border text-muted hover:border-border-strong hover:text-text',
          )}
        >
          {o.color && <span className="size-2 rounded-full" style={{ background: o.color }} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}
