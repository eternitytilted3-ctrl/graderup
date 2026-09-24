'use client'

import { cn } from '@/lib/cn'

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'relative h-10 shrink-0 px-3 text-sm font-medium transition',
            value === t.value ? 'text-text' : 'text-muted hover:text-text',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs text-subtle tnum">{t.count}</span>}
          {value === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-primary to-accent" />}
        </button>
      ))}
    </div>
  )
}
