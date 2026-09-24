import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

const tones = {
  neutral: 'bg-white/5 text-muted border-border',
  success: 'bg-success/10 text-success border-success/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  warning: 'bg-warning/10 text-warning border-warning/25',
  primary: 'bg-primary/12 text-[#b3a2ff] border-primary/30',
  accent: 'bg-accent/10 text-accent border-accent/25',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold tracking-wide uppercase', tones[tone], className)}>{children}</span>
}
