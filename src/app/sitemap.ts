import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'
import { listCases } from '@/server/services/cases'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticPaths = ['', '/cases', '/upgrade', '/rewards', '/faq', '/support', '/terms', '/privacy', '/cookies', '/aml', '/refund', '/responsible', '/risk']
  const cases = await listCases().catch(() => [])
  return [
    ...staticPaths.map((p) => ({ url: `${siteUrl}${p}`, lastModified: now, changeFrequency: p === '' ? ('daily' as const) : ('weekly' as const), priority: p === '' ? 1 : 0.6 })),
    ...cases.map((c) => ({ url: `${siteUrl}/cases/${c.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ]
}
