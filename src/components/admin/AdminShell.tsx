'use client'

import { ArrowLeft, BarChart3, Box, FileText, Gift, Menu, Package, Receipt, Settings, Shield, Ticket, Users, Wallet, CreditCard, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/components/domain/Logo'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/users', label: 'Пользователи', icon: Users },
  { href: '/admin/cases', label: 'Кейсы', icon: Box },
  { href: '/admin/items', label: 'Предметы', icon: Package },
  { href: '/admin/rewards', label: 'Награды', icon: Gift },
  { href: '/admin/promocodes', label: 'Промокоды', icon: Ticket },
  { href: '/admin/payments', label: 'Платежи', icon: CreditCard },
  { href: '/admin/withdrawals', label: 'Выводы', icon: Wallet },
  { href: '/admin/transactions', label: 'Транзакции', icon: Receipt },
  { href: '/admin/logs', label: 'Логи', icon: FileText },
  { href: '/admin/settings', label: 'Настройки', icon: Settings },
  { href: '/admin/admins', label: 'Администраторы', icon: Shield },
]

export function AdminShell({ children, username, role }: { children: React.ReactNode; username: string; role: string }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const nav = (
    <nav className="flex flex-col gap-0.5 p-3" aria-label="Админ-навигация">
      {NAV.map((n) => {
        const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href)
        return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cn('flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition', active ? 'bg-primary/15 text-text' : 'text-muted hover:bg-white/[0.04] hover:text-text')}>
            <n.icon className="size-4" />
            {n.label}
          </Link>
        )
      })}
      <Link href="/" className="mt-4 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> На сайт
      </Link>
    </nav>
  )
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur">
        <button className="rounded p-1.5 text-muted lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Меню">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Logo />
        <span className="rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-warning uppercase">Admin</span>
        <span className="ml-auto text-sm text-muted">
          {username} · <span className="text-text">{role}</span>
        </span>
      </header>
      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-border bg-bg-2/60 lg:block">{nav}</aside>
        {open && <div className="fixed inset-x-0 top-14 bottom-0 z-30 overflow-y-auto bg-bg-2 lg:hidden">{nav}</div>}
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
