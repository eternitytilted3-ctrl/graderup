import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentAuth } from '@/server/auth/session'
import { StaffLogin } from './StaffLogin'

export const metadata: Metadata = { title: 'Вход для администрации', robots: { index: false, follow: false } }

export default async function CmsAdminPage() {
  const auth = await getCurrentAuth()
  if (auth && auth.user.role !== 'user') redirect('/admin')
  return <StaffLogin />
}
