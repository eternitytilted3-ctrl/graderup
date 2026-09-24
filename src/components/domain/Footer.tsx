import Link from 'next/link'
import { legalConfig } from '@/config/legal'
import { Logo } from './Logo'

const cols = [
  { title: 'Платформа', links: [['/cases', 'Кейсы'], ['/upgrade', 'Апгрейд'], ['/inventory', 'Инвентарь'], ['/rewards', 'Награды']] },
  { title: 'Помощь', links: [['/faq', 'FAQ'], ['/support', 'Поддержка'], ['/responsible', 'Ответственная игра'], ['/risk', 'Раскрытие рисков']] },
  { title: 'Документы', links: [['/terms', 'Пользовательское соглашение'], ['/privacy', 'Политика конфиденциальности'], ['/cookies', 'Cookie Policy'], ['/aml', 'AML/KYC'], ['/refund', 'Политика возвратов']] },
] as const

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-bg-2/60 pb-20 md:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted">Открывайте кейсы, улучшайте предметы и собирайте коллекцию. Все результаты определяются на сервере.</p>
          <div className="inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-xs font-semibold text-warning">
            {legalConfig.defaultMinAge}+ · Играйте ответственно
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="label mb-3">{c.title}</div>
            <ul className="space-y-2">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted transition hover:text-text">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} GraderUP. Все права защищены.</span>
          <span>Все изображения предметов — оригинальные иллюстрации проекта. Сторонние товарные знаки не используются.</span>
        </div>
      </div>
    </footer>
  )
}
