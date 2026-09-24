import type { Metadata } from 'next'
import { LegalPage } from '@/components/domain/LegalPage'
import { legalDocs } from '@/content/legal'

const doc = legalDocs.responsible
export const metadata: Metadata = { title: doc.title, description: doc.description, alternates: { canonical: '/responsible' } }

export default function Page() {
  return <LegalPage doc={doc} />
}
