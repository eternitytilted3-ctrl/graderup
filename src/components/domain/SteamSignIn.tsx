'use client'

import { ChevronDown, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { AuthForm } from './AuthForm'

/** Generic "sign in with Steam" glyph (original drawing, not the Steam trademark logo). */
function SteamGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="15.5" cy="9.5" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.5" cy="15.5" r="2" fill="currentColor" />
      <path d="M10.2 14.6 13.2 11.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null
}

export function SteamSignIn({ steamEnabled, emailRegistration }: { steamEnabled: boolean; emailRegistration: boolean }) {
  const params = useSearchParams()
  const [showEmail, setShowEmail] = useState(false)
  const qs = new URLSearchParams()
  const ref = params.get('ref')
  const next = safeNext(params.get('next'))
  if (ref) qs.set('ref', ref)
  if (next) qs.set('next', next)
  const href = `/api/auth/steam${qs.size ? `?${qs}` : ''}`
  const steamError = params.get('error') === 'steam'

  return (
    <div className="mx-auto w-full max-w-md py-10 sm:py-16">
      <div className="card overflow-hidden">
        <div className="relative border-b border-border bg-[url(/assets/topo.svg)] bg-[length:600px_auto] px-6 py-8 text-center sm:px-8">
          <h1 className="h-tactical text-3xl">Авторизация</h1>
          <p className="mt-2 text-sm text-muted">Войдите через Steam — регистрация не нужна, аккаунт создастся автоматически.</p>
        </div>
        <div className="p-6 sm:p-8">
          {steamError && (
            <div role="alert" className="mb-5 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
              Не удалось войти через Steam. Попробуйте ещё раз.
            </div>
          )}
          {steamEnabled ? (
            <a
              href={href}
              data-testid="steam-login"
              className="group flex h-14 w-full items-center justify-center gap-3 rounded-[var(--radius-md)] bg-gradient-to-b from-[#2a475e] to-[#1b2838] font-display text-lg font-medium tracking-wide text-white uppercase ring-1 ring-[#66c0f4]/40 transition hover:ring-[#66c0f4] hover:shadow-[0_8px_28px_-10px_rgba(102,192,244,0.7)]"
            >
              <SteamGlyph className="size-6 text-[#66c0f4] transition group-hover:scale-110" />
              Войти через Steam
            </a>
          ) : (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">Вход через Steam отключён (STEAM_AUTH_ENABLED=false).</div>
          )}
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            <span>
              Мы получаем только ваш публичный Steam ID, ник и аватар. Пароль Steam вводится на сайте Steam. Входя, вы подтверждаете, что вам есть 18 лет, и принимаете{' '}
              <Link href="/terms" className="text-accent hover:underline">
                условия
              </Link>{' '}
              и{' '}
              <Link href="/privacy" className="text-accent hover:underline">
                политику конфиденциальности
              </Link>
              .
            </span>
          </p>
          <button onClick={() => setShowEmail((v) => !v)} className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-subtle transition hover:text-muted" aria-expanded={showEmail}>
            Вход по email (для администраторов) <ChevronDown className={cn('size-3.5 transition', showEmail && 'rotate-180')} />
          </button>
        </div>
      </div>
      {showEmail && (
        <div className="-mt-6">
          <AuthForm mode="login" steamEnabled={false} embedded showRegisterLink={emailRegistration} />
        </div>
      )}
    </div>
  )
}
