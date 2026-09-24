import type { Metadata } from 'next'
import Link from 'next/link'
import { ItemCard } from '@/components/domain/ItemCard'
import { Avatar } from '@/components/domain/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { requireUser } from '@/server/auth/guard'
import { getHistory, getProfile } from '@/server/services/profile'
import { HistoryTable } from '@/components/domain/HistoryTable'

export const metadata: Metadata = { title: 'Профиль', robots: { index: false } }

export default async function ProfilePage() {
  const auth = await requireUser('/profile')
  const [{ user, stats }, history] = await Promise.all([getProfile(auth.user.id), getHistory(auth.user.id, { page: 1, pageSize: 8, type: 'all' })])
  const winRate = stats.upgrades ? Math.round((stats.upgradeWins / stats.upgrades) * 100) : 0
  const tiles = [
    ['Баланс', formatMoney(user.balance)],
    ['Кейсов открыто', stats.casesOpened.toLocaleString('ru-RU')],
    ['Апгрейдов', `${stats.upgrades} · ${winRate}% успех`],
    ['Стоимость инвентаря', formatMoney(stats.inventoryValue)],
    ['Предметов', stats.inventoryCount.toLocaleString('ru-RU')],
    ['Всего пополнено', formatMoney(stats.totalDeposited)],
  ]
  return (
    <div className="container-page">
      <section className="card mt-8 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar name={user.username} src={user.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">{user.username}</h1>
            {user.role !== 'user' && <Badge tone="primary">{user.role}</Badge>}
          </div>
          <div className="mt-1 text-sm text-muted">
            {user.email ?? 'Steam'} · на сайте с {formatDate(user.createdAt, false)}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/deposit">
            <Button>Пополнить</Button>
          </Link>
          <Link href="/withdraw">
            <Button variant="secondary">Вывести</Button>
          </Link>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className="text-xs text-muted">{k}</div>
            <div className="mt-1.5 font-display text-lg font-bold tnum">{v}</div>
          </div>
        ))}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <section>
          <h2 className="mb-4 font-display text-lg font-bold">Лучший дроп</h2>
          {stats.bestDrop ? <ItemCard item={stats.bestDrop} /> : <p className="text-sm text-muted">Пока нет предметов.</p>}
          <div className="card mt-4 p-4 text-sm">
            <div className="text-muted">Приглашено друзей</div>
            <div className="mt-1 font-display text-lg font-bold">{stats.referrals}</div>
            <Link href="/rewards" className="mt-2 inline-block text-accent hover:underline">
              Реферальная программа →
            </Link>
          </div>
        </section>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Последние операции</h2>
            <Link href="/history" className="text-sm text-muted hover:text-text">
              Вся история →
            </Link>
          </div>
          <HistoryTable rows={history.items as never} />
        </section>
      </div>
    </div>
  )
}
