'use client'

import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  dismissible?: boolean
  className?: string
}

export function Modal({ open, onClose, title, children, footer, size = 'md', dismissible = true, className }: ModalProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose()
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [open, onClose, dismissible])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={() => dismissible && onClose()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-pop flex-col overflow-hidden rounded-t-[var(--radius-xl)] border border-border bg-bg-2 shadow-2xl outline-none sm:rounded-[var(--radius-xl)]',
          { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl' }[size],
          className,
        )}
      >
        {(title || dismissible) && (
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <h2 id={titleId} className="font-display text-base font-semibold">
              {title}
            </h2>
            {dismissible && (
              <button onClick={onClose} className="-mr-1 rounded-md p-1.5 text-muted transition hover:bg-white/5 hover:text-text" aria-label="Закрыть">
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
