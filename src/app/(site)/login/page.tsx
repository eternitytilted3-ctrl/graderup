import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { SteamSignIn } from '@/components/domain/SteamSignIn'
import { enabledProviders } from '@/server/auth/service'
import { getCurrentAuth } from '@/server/auth/session'

export const metadata: Metadata = { title: 'Авторизация', alternates: { canonical: '/login' }, robots: { index: false } }

export default async function Page() {
  if (await getCurrentAuth()) redirect('/')
  const p = enabledProviders()
  return (
    <div className="container-page">
      <Suspense>
        <SteamSignIn steamEnabled={p.steam} />
      </Suspense>
    </div>
  )
}
