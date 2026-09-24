'use client'

import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import type { PublicUserDTO } from '@/lib/types'

interface SessionCtx {
  user: PublicUserDTO | null
  setBalance: (balance: string) => void
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<SessionCtx | null>(null)

export function SessionProvider({ initialUser, children }: { initialUser: PublicUserDTO | null; children: ReactNode }) {
  const [user, setUser] = useState(initialUser)
  const router = useRouter()

  const refresh = useCallback(async () => {
    const r = await api<{ user: PublicUserDTO | null }>('/api/auth/me')
    setUser(r.user)
  }, [])
  const setBalance = useCallback((balance: string) => setUser((u) => (u ? { ...u, balance } : u)), [])
  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    router.push('/')
    router.refresh()
  }, [router])

  const value = useMemo(() => ({ user, setBalance, refresh, logout }), [user, setBalance, refresh, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
