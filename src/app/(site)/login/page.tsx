import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AuthForm } from '@/components/domain/AuthForm'
import { enabledProviders } from '@/server/auth/service'
import { getCurrentAuth } from '@/server/auth/session'

export const metadata: Metadata = { title: 'Вход', alternates: { canonical: '/login' }, robots: { index: false } }

export default async function Page() {
  if (await getCurrentAuth()) redirect('/')
  return (
    <div className="container-page">
      <Suspense>
        <AuthForm mode="login" steamEnabled={enabledProviders().steam} />
      </Suspense>
    </div>
  )
}
