import { AlertTriangle, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-[var(--radius-md)]', className)} aria-hidden />
}

export function LoadingState({ label = 'Загрузка…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-muted', className)} role="status">
      <Spinner className="size-6 text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-card-2 text-subtle">{icon ?? <Inbox className="size-5" />}</div>
      <div className="font-display font-semibold">{title}</div>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Не удалось загрузить данные', description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-danger/25 bg-danger/[0.04] px-6 py-12 text-center" role="alert">
      <AlertTriangle className="size-6 text-danger" />
      <div className="font-display font-semibold">{title}</div>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-1 text-sm font-medium text-accent hover:underline">
          Повторить
        </button>
      )}
    </div>
  )
}
