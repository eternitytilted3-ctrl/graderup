'use client'

import { Box, Gift, Menu, Package, TrendingUp, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { t } from '@/i18n/ru'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/money'
import { useSession } from '../SessionProvider'
import { Button } from '../ui/Button'
import { BalanceWidget } from './BalanceWidget'
import { Logo } from './Logo'
import { ProfileDropdown } from './ProfileDropdown'

export const NAV = [
  { href: '/cases', label: t.nav.cases, icon: Box },
  { href: '/upgrade', label: t.nav.upgrade, icon: TrendingUp },
  { href: '/inventory', label: t.nav.inventory, icon: Package },
  { href: '/rewards', label: t.nav.rewards, icon: Gift },
]

export function Header() {
  const { user, logout } = useSession()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenu(false), [pathname])

  return (
    <header className={cn('sticky top-0 z-40 border-b border-border/80 bg-[#0d1118]/90 bg-[url(/assets/topo.svg)] bg-[length:700px_auto] backdrop-blur-xl transition-shadow duration-200', scrolled && 'shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)]')}>
      <div className="container-page flex h-16 items-center gap-4">
        <Logo />
        <nav className="hidden flex-1 items-center justify-center md:flex" aria-label="Основная навигация">
          {NAV.map((n, i) => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/')
            return (
              <span key={n.href} className="flex items-center">
                {i > 0 && <span className="h-5 w-px bg-border-strong" aria-hidden />}
                <Link
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('relative px-5 py-2 font-display text-[17px] font-medium tracking-wide uppercase transition lg:px-7', active ? 'text-accent' : 'text-text/85 hover:text-text')}
                >
                  {n.label}
                  {active && <span className="absolute inset-x-5 -bottom-[13px] h-0.5 bg-accent lg:inset-x-7" />}
                </Link>
              </span>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {user ? (
            <>
              <BalanceWidget />
              <Link href="/deposit" className="hidden lg:block">
                <Button size="md">{t.actions.deposit}</Button>
              </Link>
              <div className="hidden md:block">
                <ProfileDropdown />
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost">{t.auth.login}</Button>
              </Link>
              <Link href="/register">
                <Button>{t.auth.register}</Button>
              </Link>
            </>
          )}
          <button className="grid size-10 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-text md:hidden" onClick={() => setMenu((m) => !m)} aria-label="Меню" aria-expanded={menu}>
            {menu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {menu && (
        <div className="animate-fade-in border-t border-border bg-bg-2/95 backdrop-blur-xl md:hidden">
          <nav className="container-page flex flex-col py-2" aria-label="Мобильное меню">
            {user && (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card px-3 py-3">
                <div>
                  <div className="text-sm font-semibold">{user.username}</div>
                  <div className="text-xs text-muted tnum">{formatMoney(user.balance)}</div>
                </div>
                <Link href="/deposit">
                  <Button size="sm">{t.actions.deposit}</Button>
                </Link>
              </div>
            )}
            {[...NAV, ...(user ? [{ href: '/history', label: t.nav.history }, { href: '/profile', label: t.nav.profile }, { href: '/withdraw', label: t.actions.withdraw }] : []), ...(user && user.role !== 'user' ? [{ href: '/admin', label: t.nav.admin }] : []), { href: '/faq', label: 'FAQ' }, { href: '/support', label: 'Поддержка' }].map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-3 text-[15px] text-muted transition hover:bg-white/[0.04] hover:text-text">
                {n.label}
              </Link>
            ))}
            {user ? (
              <button onClick={logout} className="rounded-md px-3 py-3 text-left text-[15px] text-danger">
                {t.auth.logout}
              </button>
            ) : (
              <Link href="/login" className="rounded-md px-3 py-3 text-[15px] text-text">
                {t.auth.login}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
