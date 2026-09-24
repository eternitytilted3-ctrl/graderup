import type { Metadata, Viewport } from 'next'
import { Inter, Oswald } from 'next/font/google'
import { SessionProvider } from '@/components/SessionProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { siteDescription, siteName, siteUrl } from '@/lib/site'
import { getCurrentAuth } from '@/server/auth/session'
import { toPublicUser } from '@/server/services/mappers'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap' })
const oswald = Oswald({ subsets: ['latin', 'cyrillic'], variable: '--font-oswald', display: 'swap', weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${siteName} — кейсы, апгрейд и инвентарь`, template: `%s — ${siteName}` },
  description: siteDescription,
  applicationName: siteName,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName, locale: 'ru_RU', url: siteUrl, title: `${siteName} — кейсы, апгрейд и инвентарь`, description: siteDescription },
  twitter: { card: 'summary_large_image', title: siteName, description: siteDescription },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#080B12',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentAuth()
  return (
    <html lang="ru" className={`${inter.variable} ${oswald.variable}`}>
      <body>
        <SessionProvider initialUser={auth ? toPublicUser(auth.user) : null}>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
