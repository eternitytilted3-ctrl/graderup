import type { Metadata } from 'next'
import { requireUser } from '@/server/auth/guard'
import { RewardsView } from './RewardsView'

export const metadata: Metadata = { title: 'Награды', description: 'Ежедневные, еженедельные и реферальные награды GraderUP, промокоды.', alternates: { canonical: '/rewards' } }

export default async function RewardsPage() {
  await requireUser('/rewards')
  return <RewardsView />
}
