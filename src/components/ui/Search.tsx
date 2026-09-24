'use client'

import { Search as SearchIcon, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

/** Debounced search input. */
export function Search({ value, onChange, placeholder = 'Поиск…', delay = 300, className }: { value: string; onChange: (v: string) => void; placeholder?: string; delay?: number; className?: string }) {
  const [local, setLocal] = useState(value)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => onChange(local.trim()), delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, delay])
  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
      <input className="input h-10 pr-8 pl-9" value={local} onChange={(e) => setLocal(e.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={64} />
      {local && (
        <button className="absolute top-1/2 right-2.5 -translate-y-1/2 text-subtle hover:text-text" onClick={() => setLocal('')} aria-label="Очистить">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
