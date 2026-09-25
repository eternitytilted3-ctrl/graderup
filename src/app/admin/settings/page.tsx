'use client'

import { useState } from 'react'
import { AdminTitle } from '@/components/admin/ui'
import { useSession } from '@/components/SessionProvider'
import { Button } from '@/components/ui/Button'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { useFetch } from '@/lib/useFetch'

const DESCRIPTIONS: Record<string, string> = {
  upgrade: 'Формула апгрейда: chance = clamp(source/target × (1 − houseEdge) × 100, minChance, maxChance). Множители ограничивают цели.',
  inventory: 'sellRatio — доля стоимости предмета при продаже (0.1…1).',
  deposit: 'Лимиты и пресеты пополнения.',
  withdraw: 'Лимиты вывода и доступные способы. Также требуется FEATURE_WITHDRAW=true.',
  referral: 'Бонус приглашённому на первый депозит, %.',
  pricing: 'Провайдер рыночных цен в рублях (auto = market.csgo.com → Skinport | marketcsgo | skinport | steam | mock | none), наценка % и минимальная цена. PRICE_PROVIDER в ENV имеет приоритет.',
  site: 'Технические флаги. showOnline — показывать реальный онлайн в ленте.',
  cases: 'rtp — целевой возврат для «Подогнать под RTP» и пересборки кейсов (0.68 = 68%). showOdds — показывать игрокам шансы/цены/качество содержимого кейсов.',
  drops: 'Веса качества, которое выпадает после выбора скина (нормируются по существующим вариантам).',
  skinWithdraw: 'Вывод скинов в Steam: enabled — открыт/закрыт, maxActive — одновременных выводов на игрока.',
}

function SettingEditor({ k, value, canEdit, onSaved }: { k: string; value: unknown; canEdit: boolean; onSaved: () => void }) {
  const toast = useToast()
  const [text, setText] = useState(JSON.stringify(value, null, 2))
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  async function save() {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setErr('Некорректный JSON')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { key: k, value: parsed } })
      toast.success(`Настройка «${k}» сохранена`)
      onSaved()
    } catch (e) {
      const ae = e as ApiError
      setErr(ae.fields ? Object.entries(ae.fields).map(([f, m]) => `${f}: ${m}`).join('; ') : ae.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="card flex flex-col p-4">
      <div className="font-mono text-sm font-semibold">{k}</div>
      <p className="mt-1 text-xs text-muted">{DESCRIPTIONS[k]}</p>
      <textarea className="input mt-3 h-44 py-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} readOnly={!canEdit} spellCheck={false} aria-label={`Настройка ${k}`} />
      {err && <div className="mt-2 text-xs text-danger">{err}</div>}
      {canEdit && (
        <Button size="sm" className="mt-3 self-start" onClick={save} loading={saving}>
          Сохранить
        </Button>
      )}
    </div>
  )
}

export default function AdminSettings() {
  const { user } = useSession()
  const { data, error, reload } = useFetch<Record<string, unknown>>('/api/admin/settings')
  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <LoadingState />
  const canEdit = user?.role === 'superadmin'
  return (
    <>
      <AdminTitle title="Настройки" description={canEdit ? 'Все значения валидируются сервером. Изменения записываются в журнал.' : 'Только просмотр: изменять настройки может superadmin.'} />
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {Object.entries(data).map(([k, v]) => (
          <SettingEditor key={k + JSON.stringify(v)} k={k} value={v} canEdit={canEdit} onSaved={reload} />
        ))}
      </div>
    </>
  )
}
