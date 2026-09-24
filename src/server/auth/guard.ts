import 'server-only'
import { redirect } from 'next/navigation'
import { getCurrentAuth } from './session'

/** Server Component guard: redirects to /login if there is no valid session. */
export async function requireUser(next: string) {
  const auth = await getCurrentAuth()
  if (!auth) redirect(`/login?next=${encodeURIComponent(next)}`)
  return auth
}

export async function requireAdmin() {
  const auth = await getCurrentAuth()
  if (!auth) redirect('/cmsadmin')
  if (auth.user.role === 'user') redirect('/')
  return auth
}
