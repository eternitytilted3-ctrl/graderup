import type { Metadata } from 'next'
import { Mail, MessageCircle, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/domain/PageHeader'
import { legalConfig } from '@/config/legal'

export const metadata: Metadata = { title: 'Поддержка', description: 'Связаться со службой поддержки GraderUP.', alternates: { canonical: '/support' } }

export default function SupportPage() {
  const cards = [
    { icon: Mail, title: 'Email', text: legalConfig.supportEmail, href: `mailto:${legalConfig.supportEmail}` },
    { icon: MessageCircle, title: 'FAQ', text: 'Ответы на частые вопросы', href: '/faq' },
    { icon: ShieldAlert, title: 'Ответственная игра', text: 'Лимиты и самоисключение', href: '/responsible' },
  ]
  return (
    <div className="container-page max-w-4xl">
      <PageHeader title="Поддержка" description="Опишите проблему, укажите имя пользователя и ID операции из истории — так мы ответим быстрее." />
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.title} href={c.href} className="card p-5 transition hover:border-primary/40">
            <c.icon className="size-5 text-accent" />
            <div className="mt-3 font-display font-semibold">{c.title}</div>
            <div className="mt-1 text-sm break-all text-muted">{c.text}</div>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">Мы никогда не просим пароль, коды из писем или данные карты. Сотрудники поддержки не пишут первыми в мессенджерах.</p>
    </div>
  )
}
