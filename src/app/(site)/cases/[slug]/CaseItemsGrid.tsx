'use client'

import { useMemo, useState } from 'react'
import { ItemCard } from '@/components/domain/ItemCard'
import { rarityColor } from '@/components/domain/RarityBadge'
import { Filter } from '@/components/ui/Filter'
import { EmptyState } from '@/components/ui/States'
import { t } from '@/i18n/ru'
import { RARITIES, type CaseItemDTO, type Rarity } from '@/lib/types'

export function CaseItemsGrid({ items }: { items: CaseItemDTO[] }) {
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const present = useMemo(() => RARITIES.filter((r) => items.some((i) => i.rarity === r)), [items])
  const list = rarity === 'all' ? items : items.filter((i) => i.rarity === rarity)
  const totalChance = (r: Rarity) => items.filter((i) => i.rarity === r).reduce((s, i) => s + Number(i.chance), 0)
  return (
    <>
      <div className="mb-5">
        <Filter
          ariaLabel="Фильтр по редкости"
          value={rarity}
          onChange={setRarity}
          options={[{ value: 'all', label: 'Все' }, ...present.map((r) => ({ value: r, label: `${t.rarity[r]} · ${totalChance(r).toFixed(2)}%`, color: rarityColor[r] }))]}
        />
      </div>
      {list.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {list.map((i) => (
            <ItemCard key={i.id} item={i} chance={i.chance} />
          ))}
        </div>
      ) : (
        <EmptyState title="Нет предметов этой редкости" />
      )}
    </>
  )
}
