'use client'

import { useMemo, useState } from 'react'
import { CaseCard } from '@/components/domain/CaseCard'
import { Filter } from '@/components/ui/Filter'
import { Search } from '@/components/ui/Search'
import { EmptyState } from '@/components/ui/States'
import type { CaseCategoryDTO, CaseDTO } from '@/lib/types'

const PRICE = [
  { value: 'all', label: 'Все', min: 0, max: Infinity },
  { value: 'lt50', label: 'До 50 C', min: 0, max: 50 },
  { value: '50-150', label: '50 – 150 C', min: 50, max: 150 },
  { value: '150-500', label: '150 – 500 C', min: 150, max: 500 },
  { value: '500-2000', label: '500 – 2 000 C', min: 500, max: 2000 },
  { value: 'gt2000', label: 'От 2 000 C', min: 2000, max: Infinity },
] as const
type PriceFilter = (typeof PRICE)[number]['value']

export function CasesCatalog({ sections }: { sections: { category: CaseCategoryDTO; cases: CaseDTO[] }[] }) {
  const [q, setQ] = useState('')
  const [price, setPrice] = useState<PriceFilter>('all')
  const visible = useMemo(() => {
    const range = PRICE.find((p) => p.value === price)!
    return sections
      .map((s) => ({
        ...s,
        cases: s.cases.filter((c) => {
          const p = Number(c.price)
          return p >= range.min && p < range.max && (!q || c.name.toLowerCase().includes(q.toLowerCase()))
        }),
      }))
      .filter((s) => s.cases.length > 0)
  }, [sections, q, price])

  return (
    <>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Filter options={PRICE.map(({ value, label }) => ({ value, label }))} value={price} onChange={setPrice} ariaLabel="Фильтр по цене" />
        <Search value={q} onChange={setQ} placeholder="Поиск кейса" className="lg:w-64" />
      </div>
      {visible.length ? (
        <div className="space-y-12">
          {visible.map((s, si) => (
            <section key={s.category.id} aria-labelledby={`cat-${s.category.slug}`}>
              <h2 id={`cat-${s.category.slug}`} className="h-tactical mb-4 flex items-center gap-3 text-2xl sm:text-[28px]">
                {s.category.name}
                <span className="h-px flex-1 bg-gradient-to-r from-border-strong to-transparent" aria-hidden />
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5" data-testid="case-section">
                {s.cases.map((c, i) => (
                  <CaseCard key={c.id} c={c} priority={si === 0 && i < 4} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title="Кейсы не найдены" description="Попробуйте изменить фильтры." />
      )}
    </>
  )
}
