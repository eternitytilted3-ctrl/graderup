import type { Metadata } from 'next'
import { FaqList } from '@/components/domain/FaqList'
import { PageHeader } from '@/components/domain/PageHeader'

export const metadata: Metadata = { title: 'FAQ', description: 'Ответы на частые вопросы о кейсах, апгрейде, балансе и безопасности GraderUP.', alternates: { canonical: '/faq' } }

export default function FaqPage() {
  return (
    <div className="container-page max-w-3xl">
      <PageHeader title="Частые вопросы" description="Не нашли ответ? Напишите в поддержку." />
      <FaqList />
    </div>
  )
}
