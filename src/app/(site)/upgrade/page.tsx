import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getCurrentAuth } from '@/server/auth/session'
import { getUpgradeConfigPublic } from '@/server/services/upgrade'
import { UpgradeView } from './UpgradeView'

export const metadata: Metadata = {
  title: 'Апгрейд предметов',
  description: 'Улучшайте предметы GraderUP до более ценных: шанс рассчитывается на сервере по прозрачной формуле.',
  alternates: { canonical: '/upgrade' },
}

export default async function UpgradePage() {
  const [auth, cfg] = await Promise.all([getCurrentAuth(), getUpgradeConfigPublic()])
  return (
    <Suspense>
      <UpgradeView authed={Boolean(auth)} config={cfg} />
    </Suspense>
  )
}
