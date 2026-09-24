import type { ReactNode } from 'react'

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-4 pt-8 pb-6 sm:flex-row sm:items-end sm:justify-between sm:pt-10">
      <div>
        {eyebrow && <div className="label mb-2 text-accent/80">{eyebrow}</div>}
        <h1 className="h-tactical text-3xl sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted sm:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
