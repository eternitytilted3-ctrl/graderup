import type { Metadata } from 'next'
import { requireUser } from '@/server/auth/guard'
import { InventoryView } from './InventoryView'

export const metadata: Metadata = { title: 'Инвентарь', robots: { index: false } }

export default async function InventoryPage() {
  await requireUser('/inventory')
  return <InventoryView />
}
