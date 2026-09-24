import type { Metadata } from 'next'
import { LegalPage } from '@/components/domain/LegalPage'
import { legalDocs } from '@/content/legal'

const doc = legalDocs.aml
export const metadata: Metadata = { title: doc.title, description: doc.description, alternates: { canonical: '/aml' } }

export default function Page() {
  return <LegalPage doc={doc} />
}
