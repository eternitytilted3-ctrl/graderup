import { Footer } from '@/components/domain/Footer'
import { Header } from '@/components/domain/Header'
import { MobileNav } from '@/components/domain/MobileNav'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[300] focus:rounded focus:bg-primary focus:px-3 focus:py-2">
        Перейти к содержимому
      </a>
      <Header />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer />
      <MobileNav />
    </>
  )
}
