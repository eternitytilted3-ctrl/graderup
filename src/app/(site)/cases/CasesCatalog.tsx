'use client'

import { useMemo, useState } from 'react'
import { CaseCard } from '@/components/domain/CaseCard'
import { Filter } from '@/components/ui/Filter'
import { Search } from '@/components/ui/Search'
import { EmptyState } from '@/components/ui/States'
import type { CaseDTO } from '@/lib/types'

const PRICE = [
  { value: 'all', label: 'Все' },
  { value: 'lt5', label: 'До $5' },
  { value: '5-25', label: '$5 – $25' },
  { value: '25-100', label: '$25 – $100' },
  { value: 'gt100', label: 'От $100' },
] as const
type PriceFilter = (typeof PRICE)[number]['value']

export function CasesCatalog({ cases }: { cases: CaseDTO[] }) {
  const [q, setQ] = useState('')
  const [price, setPrice] = useState<PriceFilter>('all')
  const [sort, setSort] = useState<'price_asc' | 'price_desc' | 'featured'>('featured')
  const list = useMemo(() => {
    const inRange = (p: number) =>
      price === 'all' || (price === 'lt5' && p < 5) || (price === '5-25' && p >= 5 && p < 25) || (price === '25-100' && p >= 25 && p < 100) || (price === 'gt100' && p >= 100)
    const out = cases.filter((c) => inRange(Number(c.price)) && (!q || c.name.toLowerCase().includes(q.toLowerCase())))
    if (sort === 'price_asc') out.sort((a, b) => Number(a.price) - Number(b.price))
    if (sort === 'price_desc') out.sort((a, b) => Number(b.price) - Number(a.price))
    if (sort === 'featured') out.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured))
    return out
  }, [cases, q, price, sort])

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Filter options={[...PRICE]} value={price} onChange={setPrice} ariaLabel="Фильтр по цене" />
        <div className="flex gap-2">
          <Search value={q} onChange={setQ} placeholder="Поиск кейса" className="flex-1 lg:w-60" />
          <select className="input h-10 w-auto pr-8" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Сортировка">
            <option value="featured">Популярные</option>
            <option value="price_asc">Сначала дешёвые</option>
            <option value="price_desc">Сначала дорогие</option>
          </select>
        </div>
      </div>
      {list.length ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.map((c, i) => (
            <CaseCard key={c.id} c={c} priority={i < 4} />
          ))}
        </div>
      ) : (
        <EmptyState title="Кейсы не найдены" description="Попробуйте изменить фильтры." />
      )}
    </>
  )
}
