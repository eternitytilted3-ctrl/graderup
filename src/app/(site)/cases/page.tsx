import type { Metadata } from 'next'
import { CasesCatalog } from './CasesCatalog'
import { PageHeader } from '@/components/domain/PageHeader'
import { listCaseCatalog } from '@/server/services/cases'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Кейсы',
  description: 'Каталог кейсов GraderUP: бюджетные, классика, коллекции, ножи и перчатки, limited — скины CS2 на любой бюджет.',
  alternates: { canonical: '/cases' },
}

export default async function CasesPage() {
  const sections = await listCaseCatalog()
  return (
    <div className="container-page">
      <PageHeader eyebrow="Каталог" title="Кейсы" description="Выберите кейс, посмотрите, какие скины в нём лежат, и откройте его — до 5 штук за раз." />
      <CasesCatalog sections={sections} />
    </div>
  )
}
