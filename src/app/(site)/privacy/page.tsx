import type { Metadata } from 'next'
import { LegalPage } from '@/components/domain/LegalPage'
import { legalDocs } from '@/content/legal'

const doc = legalDocs.privacy
export const metadata: Metadata = { title: doc.title, description: doc.description, alternates: { canonical: '/privacy' } }

export default function Page() {
  return <LegalPage doc={doc} />
}
