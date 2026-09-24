'use client'

import { Plus, Wallet } from 'lucide-react'
import Link from 'next/link'
import { formatMoney } from '@/lib/money'
import { useSession } from '../SessionProvider'

export function BalanceWidget() {
  const { user } = useSession()
  if (!user) return null
  return (
    <div className="flex h-10 items-center overflow-hidden rounded-[var(--radius-md)] border border-border bg-bg-2">
      <div className="flex items-center gap-2 px-3" aria-label="Баланс">
        <Wallet className="size-4 text-accent" />
        <span className="font-display text-sm font-bold tnum" data-testid="balance">
          {formatMoney(user.balance)}
        </span>
      </div>
      <Link href="/deposit" className="grid h-full w-10 place-items-center bg-primary text-white transition hover:bg-primary-hover" aria-label="Пополнить баланс" title="Пополнить">
        <Plus className="size-4" />
      </Link>
    </div>
  )
}
