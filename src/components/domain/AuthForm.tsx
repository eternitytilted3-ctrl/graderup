'use client'

import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { useSession } from '@/components/SessionProvider'
import { Button } from '@/components/ui/Button'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'

function Field({ label, name, type = 'text', error, autoComplete, ...rest }: { label: string; name: string; type?: string; error?: string; autoComplete?: string; defaultValue?: string; placeholder?: string }) {
  const [show, setShow] = useState(false)
  const isPw = type === 'password'
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <span className="relative block">
        <input
          name={name}
          type={isPw && show ? 'text' : type}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          className={cn('input', error && 'border-danger/60', isPw && 'pr-10')}
          {...rest}
        />
        {isPw && (
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-3 -translate-y-1/2 text-subtle hover:text-text" aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </span>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}

/** Only allow same-site relative redirects (prevents open redirect). */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function AuthForm({ mode, steamEnabled }: { mode: 'login' | 'register'; steamEnabled: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const { refresh } = useSession()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(params.get('error') === 'steam' ? 'Не удалось войти через Steam' : null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErrors({})
    setFormError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await api('/api/auth/login', { body: { login: fd.get('login'), password: fd.get('password') } })
      } else {
        await api('/api/auth/register', {
          body: {
            username: fd.get('username'),
            email: fd.get('email'),
            password: fd.get('password'),
            referralCode: fd.get('referralCode') || undefined,
            acceptTerms: fd.get('acceptTerms') === 'on',
            confirmAge: fd.get('confirmAge') === 'on',
          },
        })
      }
      await refresh()
      router.push(safeNext(params.get('next')))
      router.refresh()
    } catch (err) {
      const e = err as ApiError
      if (e.fields) setErrors(e.fields)
      setFormError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md py-10 sm:py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{mode === 'login' ? 'Вход в аккаунт' : 'Создание аккаунта'}</h1>
        <p className="mt-1.5 text-sm text-muted">{mode === 'login' ? 'Рады видеть вас снова.' : 'Регистрация займёт меньше минуты.'}</p>
        {formError && (
          <div role="alert" className="mt-5 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {formError}
          </div>
        )}
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {mode === 'login' ? (
            <>
              <Field label="Email или имя пользователя" name="login" autoComplete="username" error={errors.login} />
              <Field label="Пароль" name="password" type="password" autoComplete="current-password" error={errors.password} />
            </>
          ) : (
            <>
              <Field label="Имя пользователя" name="username" autoComplete="username" error={errors.username} placeholder="latin, цифры, _" />
              <Field label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
              <Field label="Пароль" name="password" type="password" autoComplete="new-password" error={errors.password} placeholder="Минимум 8 символов, буква и цифра" />
              <Field label="Реферальный код (необязательно)" name="referralCode" error={errors.referralCode} defaultValue={params.get('ref') ?? ''} />
              <label className="flex items-start gap-2.5 text-sm text-muted">
                <input type="checkbox" name="confirmAge" className="mt-0.5 size-4 accent-[#7C5CFF]" />
                <span>Мне исполнилось 18 лет (или больше, если этого требует закон моей страны)</span>
              </label>
              {errors.confirmAge && <span className="-mt-2 block text-xs text-danger">{errors.confirmAge}</span>}
              <label className="flex items-start gap-2.5 text-sm text-muted">
                <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 accent-[#7C5CFF]" />
                <span>
                  Я принимаю{' '}
                  <Link href="/terms" className="text-accent hover:underline">
                    условия
                  </Link>{' '}
                  и{' '}
                  <Link href="/privacy" className="text-accent hover:underline">
                    политику конфиденциальности
                  </Link>
                </span>
              </label>
              {errors.acceptTerms && <span className="-mt-2 block text-xs text-danger">{errors.acceptTerms}</span>}
            </>
          )}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </Button>
        </form>
        {steamEnabled && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" /> или <span className="h-px flex-1 bg-border" />
            </div>
            <a href="/api/auth/steam" className="block">
              <Button variant="secondary" size="lg" className="w-full" type="button">
                Войти через Steam
              </Button>
            </a>
          </>
        )}
        <p className="mt-6 text-center text-sm text-muted">
          {mode === 'login' ? (
            <>
              Нет аккаунта?{' '}
              <Link href="/register" className="font-medium text-accent hover:underline">
                Зарегистрироваться
              </Link>
            </>
          ) : (
            <>
              Уже есть аккаунт?{' '}
              <Link href="/login" className="font-medium text-accent hover:underline">
                Войти
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
