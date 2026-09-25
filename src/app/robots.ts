import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

// Read SITE_MODE at request time (a test server must never be indexed).
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  // The test server must never be indexed.
  if (process.env.SITE_MODE === 'test') return { rules: [{ userAgent: '*', disallow: '/' }] }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/inventory', '/history', '/profile', '/deposit', '/withdraw', '/login', '/register'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
