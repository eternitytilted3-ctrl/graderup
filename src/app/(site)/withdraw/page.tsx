import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireUser } from '@/server/auth/guard'
import { WithdrawView } from './WithdrawView'

export const metadata: Metadata = { title: 'Вывод средств', robots: { index: false } }

export default async function WithdrawPage() {
  await requireUser('/withdraw')
  return (
    <Suspense>
      <WithdrawView />
    </Suspense>
  )
}
