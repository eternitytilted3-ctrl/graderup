import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { AppError } from '@/server/http/errors'
import { getCase } from '@/server/services/cases'
import { CaseOpener } from './CaseOpener'
import { CaseItemsGrid } from './CaseItemsGrid'

export const dynamic = 'force-dynamic'

async function load(slug: string) {
  try {
    return await getCase(slug)
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound()
    throw err
  }
}

export async function generateMetadata({ params }: PageProps<'/cases/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  try {
    const { case: c } = await getCase(slug)
    return {
      title: `Кейс ${c.name}`,
      description: `${c.description} Цена ${formatMoney(c.price)}, ${c.itemCount} скинов CS2.`,
      alternates: { canonical: `/cases/${c.slug}` },
      openGraph: {
        title: `Кейс ${c.name} — GraderUP`,
        description: c.description,
        images: [{ url: c.image }],
      },
    }
  } catch {
    return { title: 'Кейс не найден' }
  }
}

export default async function CasePage({ params }: PageProps<'/cases/[slug]'>) {
  const { slug } = await params
  const { case: c, items, showOdds } = await load(slug)
  return (
    <div className="container-page">
      <Link href="/cases" className="mt-6 inline-flex items-center gap-1 text-sm text-muted transition hover:text-text">
        <ChevronLeft className="size-4" /> Все кейсы
      </Link>
      <section className="flex flex-wrap items-end justify-between gap-4 pt-4 pb-5">
        <div>
          <div className="label mb-2 text-accent/80">Кейс</div>
          <h1 className="h-tactical text-4xl sm:text-5xl">{c.name}</h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">{c.description}</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="font-display text-2xl font-bold text-text tnum">{formatMoney(c.price)}</span>
          <span className="h-4 w-px bg-border" />
          <span>{c.itemCount} предметов</span>
        </div>
      </section>

      <CaseOpener caseId={c.id} slug={c.slug} name={c.name} image={c.image} price={c.price} items={items} />

      <section className="pt-12">
        <h2 className="h-tactical mb-5 text-2xl">Возможные предметы</h2>
        <CaseItemsGrid items={items} showOdds={showOdds} />
      </section>
    </div>
  )
}
