import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="bg-gradient-to-r from-primary to-accent bg-clip-text font-display text-7xl font-bold text-transparent">404</div>
      <h1 className="mt-3 font-display text-xl font-bold">Страница не найдена</h1>
      <p className="mt-2 text-sm text-muted">Возможно, она была удалена или вы перешли по неверной ссылке.</p>
      <Link href="/" className="mt-6">
        <Button>На главную</Button>
      </Link>
    </div>
  )
}
