'use client'

import { ChevronDown, History, LogOut, Package, Shield, User, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { t } from '@/i18n/ru'
import { cn } from '@/lib/cn'
import { useSession } from '../SessionProvider'
import { Avatar } from './Avatar'

export function ProfileDropdown() {
  const { user, logout } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!user) return null
  const links = [
    { href: '/profile', label: t.nav.profile, icon: User },
    { href: '/inventory', label: t.nav.inventory, icon: Package },
    { href: '/history', label: t.nav.history, icon: History },
    { href: '/withdraw', label: t.actions.withdraw, icon: Wallet },
    ...(user.role !== 'user' ? [{ href: '/admin', label: t.nav.admin, icon: Shield }] : []),
  ]
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] px-1.5 transition hover:bg-white/[0.04]" aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={user.username} src={user.avatarUrl} size={30} />
        <span className="hidden max-w-28 truncate text-sm font-medium lg:block">{user.username}</span>
        <ChevronDown className={cn('hidden size-3.5 text-muted transition lg:block', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-50 mt-2 w-56 animate-fade-in overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-2 p-1.5 shadow-2xl">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{user.username}</div>
            <div className="truncate text-xs text-muted">{user.email ?? 'Steam'}</div>
          </div>
          <div className="my-1 h-px bg-border" />
          {links.map((l) => (
            <Link key={l.href} href={l.href} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted transition hover:bg-white/[0.04] hover:text-text">
              <l.icon className="size-4" />
              {l.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-border" />
          <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-danger/90 transition hover:bg-danger/10">
            <LogOut className="size-4" />
            {t.auth.logout}
          </button>
        </div>
      )}
    </div>
  )
}
