'use client'

import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Kind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: Kind
  title: string
  description?: string
}

const Ctx = createContext<{ push: (kind: Kind, title: string, description?: string) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), [])
  const push = useCallback(
    (kind: Kind, title: string, description?: string) => {
      const id = Date.now() + Math.random()
      setItems((l) => [...l.slice(-3), { id, kind, title, description }])
      setTimeout(() => remove(id), kind === 'error' ? 6000 : 4000)
    },
    [remove],
  )
  const value = useMemo(() => ({ push }), [push])
  const icons = { success: CheckCircle2, error: TriangleAlert, info: Info }
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[200] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end" aria-live="polite">
        {items.map((t) => {
          const Icon = icons[t.kind]
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm animate-fade-in items-start gap-3 rounded-[var(--radius-lg)] border bg-bg-2/95 px-4 py-3 shadow-2xl backdrop-blur',
                t.kind === 'success' && 'border-success/30',
                t.kind === 'error' && 'border-danger/40',
                t.kind === 'info' && 'border-border',
              )}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', { success: 'text-success', error: 'text-danger', info: 'text-accent' }[t.kind])} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t.title}</div>
                {t.description && <div className="mt-0.5 text-xs text-muted">{t.description}</div>}
              </div>
              <button onClick={() => remove(t.id)} className="text-subtle hover:text-text" aria-label="Закрыть уведомление">
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return {
    success: (title: string, d?: string) => ctx.push('success', title, d),
    error: (title: string, d?: string) => ctx.push('error', title, d),
    info: (title: string, d?: string) => ctx.push('info', title, d),
  }
}
