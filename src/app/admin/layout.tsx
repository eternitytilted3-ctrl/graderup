import type { Metadata } from 'next'
import { requireAdmin } from '@/server/auth/guard'
import { AdminShell } from '@/components/admin/AdminShell'

export const metadata: Metadata = { title: { default: 'Админ-панель', template: '%s · Админ — GraderUP' }, robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAdmin()
  return (
    <AdminShell username={auth.user.username} role={auth.user.role}>
      {children}
    </AdminShell>
  )
}
