'use client'

import { AdminTitle, Stat } from '@/components/admin/ui'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { formatMoney } from '@/lib/money'
import { useFetch } from '@/lib/useFetch'

interface Dash {
  users: number
  newUsers24h: number
  usersOnline: number
  revenue: { caseRevenue: string; itemsPaidOut: string; ggr: string }
  casesOpened: number
  casesOpened24h: number
  upgrades: number
  upgradeWins: number
  deposits: { count: number; sum: string }
  withdrawals: { count: number; pending: number; sum: string }
  transactions: number
  daily: { day: string; deposits: string; openings: number }[]
}

export default function AdminDashboard() {
  const { data, error, reload } = useFetch<Dash>('/api/admin/dashboard')
  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <LoadingState />
  const maxOpen = Math.max(1, ...data.daily.map((d) => d.openings))
  const maxDep = Math.max(1, ...data.daily.map((d) => Number(d.deposits)))
  return (
    <>
      <AdminTitle title="Dashboard" description="Сводка по платформе" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Пользователи" value={data.users} sub={`+${data.newUsers24h} за 24ч`} />
        <Stat label="Онлайн" value={data.usersOnline} sub="за 5 минут" />
        <Stat label="Revenue (кейсы)" value={formatMoney(data.revenue.caseRevenue)} sub={`GGR ${formatMoney(data.revenue.ggr)}`} />
        <Stat label="Кейсов открыто" value={data.casesOpened} sub={`+${data.casesOpened24h} за 24ч`} />
        <Stat label="Апгрейды" value={data.upgrades} sub={`${data.upgradeWins} успешных`} />
        <Stat label="Пополнения" value={formatMoney(data.deposits.sum)} sub={`${data.deposits.count} платежей`} />
        <Stat label="Выводы" value={formatMoney(data.withdrawals.sum)} sub={`${data.withdrawals.pending} ожидают`} />
        <Stat label="Транзакции" value={data.transactions} />
        <Stat label="Выплачено предметами" value={formatMoney(data.revenue.itemsPaidOut)} />
      </div>
      <section className="card mt-6 p-4">
        <div className="mb-3 text-sm font-semibold">Последние 14 дней</div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 text-left font-medium">День</th>
              <th className="py-1 text-left font-medium">Открытий</th>
              <th className="py-1 text-left font-medium">Пополнения</th>
            </tr>
          </thead>
          <tbody>
            {data.daily.map((d) => (
              <tr key={d.day}>
                <td className="py-1 pr-3 text-muted tnum whitespace-nowrap">{d.day.slice(5)}</td>
                <td className="w-1/2 py-1 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-sm bg-primary" style={{ width: `${(d.openings / maxOpen) * 100}%`, minWidth: d.openings ? 2 : 0 }} />
                    <span className="text-xs tnum">{d.openings}</span>
                  </div>
                </td>
                <td className="w-1/2 py-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-sm bg-accent" style={{ width: `${(Number(d.deposits) / maxDep) * 100}%`, minWidth: Number(d.deposits) ? 2 : 0 }} />
                    <span className="text-xs tnum">{formatMoney(d.deposits)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
