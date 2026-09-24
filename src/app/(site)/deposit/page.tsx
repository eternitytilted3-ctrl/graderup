import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireUser } from '@/server/auth/guard'
import { mockAllowed } from '@/server/payments'
import { listPayments } from '@/server/services/payments'
import { getSetting } from '@/server/services/settings'
import { DepositView } from './DepositView'

export const metadata: Metadata = { title: 'Пополнение баланса', robots: { index: false } }

export default async function DepositPage() {
  const auth = await requireUser('/deposit')
  const [cfg, payments] = await Promise.all([getSetting('deposit'), listPayments(auth.user.id, 8)])
  return (
    <Suspense>
      <DepositView config={cfg} payments={payments} bonusPercent={auth.user.depositBonusPercent} mock={mockAllowed()} />
    </Suspense>
  )
}
