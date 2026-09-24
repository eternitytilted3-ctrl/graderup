'use client'

import { ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Logo } from '@/components/domain/Logo'
import { useSession } from '@/components/SessionProvider'
import { Button } from '@/components/ui/Button'
import { api, ApiError } from '@/lib/api'

export function StaffLogin() {
  const router = useRouter()
  const { refresh } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    try {
      await api('/api/auth/admin-login', { body: { login: fd.get('login'), password: fd.get('password') } })
      await refresh()
      router.push('/admin')
      router.refresh()
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[url(/assets/topo.svg)] bg-[length:800px_auto] p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6" noValidate>
        <div className="flex items-center justify-between">
          <Logo />
          <span className="rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-warning uppercase">Staff</span>
        </div>
        <h1 className="h-tactical flex items-center gap-2 text-2xl">
          <ShieldCheck className="size-5 text-accent" /> Вход для администрации
        </h1>
        {error && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email или логин</span>
          <input name="login" className="input" autoComplete="username" required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Пароль</span>
          <input name="password" type="password" className="input" autoComplete="current-password" required />
        </label>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Войти в админ-панель
        </Button>
        <p className="text-xs text-muted">Доступ только для администраторов. Все входы записываются в журнал безопасности.</p>
      </form>
    </div>
  )
}
