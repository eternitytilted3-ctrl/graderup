import type { Metadata } from 'next'
import { CasesCatalog } from './CasesCatalog'
import { PageHeader } from '@/components/domain/PageHeader'
import { listCases } from '@/server/services/cases'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Кейсы',
  description: 'Каталог кейсов GraderUP: прозрачные шансы, предметы всех редкостей — от Common до Mythic.',
  alternates: { canonical: '/cases' },
}

export default async function CasesPage() {
  const cases = await listCases()
  return (
    <div className="container-page">
      <PageHeader eyebrow="Каталог" title="Кейсы" description="Выберите кейс, изучите возможные предметы и их шансы, затем откройте его." />
      <CasesCatalog cases={cases} />
    </div>
  )
}
