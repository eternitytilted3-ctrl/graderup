import type { Metadata } from 'next'
import { LegalPage } from '@/components/domain/LegalPage'
import { legalDocs } from '@/content/legal'

const doc = legalDocs.cookies
export const metadata: Metadata = { title: doc.title, description: doc.description, alternates: { canonical: '/cookies' } }

export default function Page() {
  return <LegalPage doc={doc} />
}
