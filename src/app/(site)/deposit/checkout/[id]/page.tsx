import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/server/auth/guard'
import { mockAllowed } from '@/server/payments'
import { getPayment } from '@/server/services/payments'
import { MockCheckout } from './MockCheckout'

export const metadata: Metadata = { title: 'Тестовая оплата', robots: { index: false } }

/** Simulated hosted checkout of the MOCK provider (development only). */
export default async function CheckoutPage({ params }: PageProps<'/deposit/checkout/[id]'>) {
  const { id } = await params
  if (!mockAllowed() || !z.uuid().safeParse(id).success) notFound()
  const auth = await requireUser(`/deposit/checkout/${id}`)
  const payment = await getPayment(auth.user.id, id).catch(() => null)
  if (!payment) notFound()
  return <MockCheckout payment={payment} />
}
