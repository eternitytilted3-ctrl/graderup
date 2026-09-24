import type { ReactNode } from 'react'

/** Lightweight CSS tooltip (hover + keyboard focus). */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-60 -translate-x-1/2 translate-y-1 rounded-md border border-border bg-bg-2 px-2.5 py-1.5 text-xs text-muted opacity-0 shadow-xl transition group-focus-within/tt:translate-y-0 group-focus-within/tt:opacity-100 group-hover/tt:translate-y-0 group-hover/tt:opacity-100"
      >
        {content}
      </span>
    </span>
  )
}
