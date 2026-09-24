import type { Metadata } from 'next'
import { requireUser } from '@/server/auth/guard'
import { HistoryView } from './HistoryView'

export const metadata: Metadata = { title: 'История операций', robots: { index: false } }

export default async function HistoryPage() {
  await requireUser('/history')
  return <HistoryView />
}
