'use client'

import { Button } from '@/components/ui/Button'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Never render error.message: it may contain internal details.
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-2xl font-bold">Что-то пошло не так</h1>
      <p className="mt-2 text-sm text-muted">Мы уже знаем о проблеме. Попробуйте обновить страницу.</p>
      <Button className="mt-6" onClick={reset}>
        Попробовать снова
      </Button>
    </div>
  )
}
