import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AuthForm } from '@/components/domain/AuthForm'
import { enabledProviders } from '@/server/auth/service'
import { getCurrentAuth } from '@/server/auth/session'

export const metadata: Metadata = { title: 'Регистрация', robots: { index: false } }

export default async function Page({ searchParams }: PageProps<'/register'>) {
  if (await getCurrentAuth()) redirect('/')
  const p = enabledProviders()
  // Email sign-up is optional; by default everyone signs in with Steam.
  if (!p.emailRegistration) {
    const ref = (await searchParams).ref
    redirect(typeof ref === 'string' ? `/login?ref=${encodeURIComponent(ref)}` : '/login')
  }
  return (
    <div className="container-page">
      <Suspense>
        <AuthForm mode="register" steamEnabled={p.steam} />
      </Suspense>
    </div>
  )
}
