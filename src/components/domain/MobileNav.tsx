'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { NAV } from './Header'

/** Bottom navigation for phones (touch targets ≥ 56px). */
export function MobileNav() {
  const pathname = usePathname()
  if (pathname.startsWith('/admin')) return null
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Нижняя навигация">
      <div className="grid grid-cols-4">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/')
          return (
            <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={cn('flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition', active ? 'text-text' : 'text-subtle')}>
              <n.icon className={cn('size-5', active && 'text-primary')} />
              {n.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
