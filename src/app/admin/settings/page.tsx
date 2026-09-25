'use client'

import { Code2, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AdminTitle } from '@/components/admin/ui'
import { useSession } from '@/components/SessionProvider'
import { Button } from '@/components/ui/Button'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useFetch } from '@/lib/useFetch'

type Json = Record<string, unknown>

/** Field meta: how a setting value is shown and edited. The server re-validates everything. */
type Field =
  | {
      k: string
      type: 'num'
      label: string
      hint?: string
      /** Slider range (display units); the input also accepts anything the server allows. */
      min: number
      max: number
      step: number
      unit?: string
      /** Display = stored × scale (e.g. 100 for fractions shown as %). */
      scale?: number
    }
  | { k: string; type: 'bool'; label: string; hint?: string }
  | { k: string; type: 'enum'; label: string; hint?: string; options: [string, string][] }
  | { k: string; type: 'text'; label: string; hint?: string; max?: number }
  | { k: string; type: 'nums'; label: string; hint?: string }
  | { k: string; type: 'strs'; label: string; hint?: string }
  | { k: string; type: 'group'; label: string; hint?: string; fields: Field[] }

interface Section {
  title: string
  description: string
  fields: Field[]
}

const pct = (k: string, label: string, hint?: string, min = 0, max = 100, step = 0.5): Field => ({ k, type: 'num', label, hint, min, max, step, unit: '%' })
const coins = (k: string, label: string, hint?: string, max = 100000, step = 100): Field => ({ k, type: 'num', label, hint, min: 0, max, step, unit: 'C' })

const SECTIONS: Record<string, Section> = {
  upgrade: {
    title: 'Апгрейд',
    description: 'Шанс = стоимость ставки / цена цели × (1 − комиссия − бонус) × 100, в пределах мин/макс шанса.',
    fields: [
      { k: 'houseEdge', type: 'num', label: 'Комиссия сайта', hint: 'Чем выше, тем ниже шанс при том же множителе. 8% → при ×2 шанс 46%.', min: 0, max: 50, step: 0.5, unit: '%', scale: 100 },
      pct('minChance', 'Минимальный шанс', 'Ниже этого шанс не опустится (дальние цели).', 0.01, 20, 0.01),
      pct('maxChance', 'Максимальный шанс', 'Выше этого шанс не поднимется.', 1, 100, 0.5),
      { k: 'minMultiplier', type: 'num', label: 'Мин. множитель цели', hint: 'Цель должна быть дороже ставки хотя бы во столько раз.', min: 1, max: 10, step: 0.05, unit: '×' },
      { k: 'maxMultiplier', type: 'num', label: 'Макс. множитель цели', min: 2, max: 1000, step: 1, unit: '×' },
      { k: 'quickMultipliers', type: 'nums', label: 'Кнопки «Множитель»', hint: 'Через запятую, до 6 штук. Например: 1.5, 5, 33' },
      { k: 'quickChances', type: 'nums', label: 'Кнопки «Шанс», %', hint: 'Через запятую, до 6 штук. Например: 25, 50, 80' },
      coins('maxBalanceStake', 'Макс. добавка с баланса', 'Сколько монет игрок может добавить к ставке, чтобы поднять шанс. 0 — выключено.', 100000, 100),
    ],
  },
  upgradeBonus: {
    title: 'Бонус-зона апгрейда',
    description: 'Раз в N прокруток в проигрышной части колеса появляется зона: «страховка» (часть ставки возвращается) или «×2» (цель выдаётся дважды). Ожидаемая выплата бонуса учтена в шансе — общий RTP не меняется.',
    fields: [
      { k: 'enabled', type: 'bool', label: 'Бонус-зоны включены' },
      { k: 'minInterval', type: 'num', label: 'Раз в … прокруток — от', hint: 'Бонус выпадает один раз за цикл случайной длины «от–до» на случайной прокрутке внутри цикла.', min: 1, max: 50, step: 1 },
      { k: 'maxInterval', type: 'num', label: 'Раз в … прокруток — до', min: 1, max: 50, step: 1 },
      coins('maxStake', 'Макс. ставка для бонуса', 'Апгрейды дороже не получают бонус-зону (защита от злоупотреблений).', 100000, 100),
      pct('zonePercent', 'Ширина зоны', '% окружности колеса.', 0.5, 20, 0.5),
      pct('refundMinPercent', 'Страховка: возврат от', '% ставки, который вернётся на баланс (потеря 50–70% = возврат 30–50%).', 0, 100, 1),
      pct('refundMaxPercent', 'Страховка: возврат до', undefined, 0, 100, 1),
      pct('doubleSharePercent', 'Доля зон ×2', 'Остальные зоны — страховка.', 0, 100, 1),
      { k: 'doubleMaxMultiplier', type: 'num', label: 'Зона ×2 только до множителя', min: 1, max: 100, step: 0.5, unit: '×' },
    ],
  },
  cases: {
    title: 'Кейсы',
    description: 'RTP — целевой возврат при пересборке/«Подогнать под RTP».',
    fields: [
      { k: 'rtp', type: 'num', label: 'RTP кейсов', hint: '68% — в среднем игрок получает 68% стоимости кейса.', min: 30, max: 99, step: 0.5, unit: '%', scale: 100 },
      { k: 'showOdds', type: 'bool', label: 'Показывать игрокам шансы, цены и качество в кейсе' },
    ],
  },
  drops: {
    title: 'Качество (износ) при выпадении',
    description: 'Относительные веса; нормируются по вариантам, которые есть у скина.',
    fields: [
      {
        k: 'wearWeights',
        type: 'group',
        label: 'Веса качества',
        fields: [
          pct('Factory New', 'Factory New (FN)', undefined, 0, 10, 0.05),
          pct('Minimal Wear', 'Minimal Wear (MW)', undefined, 0, 60, 0.25),
          pct('Field-Tested', 'Field-Tested (FT)', undefined, 0, 80, 0.25),
          pct('Well-Worn', 'Well-Worn (WW)', undefined, 0, 60, 0.25),
          pct('Battle-Scarred', 'Battle-Scarred (BS)', undefined, 0, 80, 0.25),
        ],
      },
    ],
  },
  inventory: {
    title: 'Инвентарь',
    description: 'Продажа предметов сайту.',
    fields: [{ k: 'sellRatio', type: 'num', label: 'Цена продажи', hint: '% от цены предмета.', min: 10, max: 100, step: 1, unit: '%', scale: 100 }],
  },
  deposit: {
    title: 'Пополнение',
    description: 'Лимиты и суммы-кнопки на странице пополнения.',
    fields: [coins('minAmount', 'Минимальное пополнение', undefined, 5000, 10), coins('maxAmount', 'Максимальное пополнение', undefined, 1000000, 1000), { k: 'presets', type: 'nums', label: 'Кнопки сумм', hint: 'Через запятую, до 8.' }, { k: 'currency', type: 'text', label: 'Валюта платежа', max: 3 }],
  },
  withdraw: {
    title: 'Вывод баланса',
    description: 'Также требуется FEATURE_WITHDRAW=true в окружении.',
    fields: [
      { k: 'enabled', type: 'bool', label: 'Вывод открыт' },
      coins('minAmount', 'Минимальная сумма', undefined, 5000, 10),
      coins('maxAmount', 'Максимальная сумма', undefined, 100000, 50),
      { k: 'perDay', type: 'num', label: 'Заявок в сутки', min: 1, max: 20, step: 1 },
      { k: 'methods', type: 'strs', label: 'Способы', hint: 'Через запятую: card, crypto_usdt' },
    ],
  },
  skinWithdraw: {
    title: 'Вывод скинов в Steam',
    description: '',
    fields: [
      { k: 'enabled', type: 'bool', label: 'Вывод скинов открыт' },
      { k: 'maxActive', type: 'num', label: 'Одновременных выводов на игрока', min: 1, max: 20, step: 1 },
    ],
  },
  referral: {
    title: 'Рефералы',
    description: '',
    fields: [pct('inviteeBonusPercent', 'Бонус приглашённому на первый депозит', undefined, 0, 50, 1)],
  },
  pricing: {
    title: 'Цены скинов',
    description: 'PRICE_PROVIDER в окружении имеет приоритет. Обновить цены и кейсы: npm run prices:update.',
    fields: [
      {
        k: 'provider',
        type: 'enum',
        label: 'Источник цен',
        options: [
          ['auto', 'Авто: market.csgo.com → Skinport'],
          ['marketcsgo', 'market.csgo.com'],
          ['skinport', 'Skinport'],
          ['steam', 'Steam Market'],
          ['mock', 'Тестовый (mock)'],
          ['none', 'Выключено'],
        ],
      },
      pct('markupPercent', 'Наценка к рыночной цене', 'Может быть отрицательной.', -50, 100, 1),
      coins('minPrice', 'Минимальная цена предмета', undefined, 100, 1),
    ],
  },
  site: {
    title: 'Сайт',
    description: '',
    fields: [
      { k: 'maintenance', type: 'bool', label: 'Режим техработ' },
      { k: 'showOnline', type: 'bool', label: 'Показывать реальный онлайн' },
      { k: 'announcement', type: 'text', label: 'Объявление сверху', hint: 'До 280 символов, пусто — скрыто.', max: 280 },
    ],
  },
}

const round = (v: number, step: number) => {
  const d = (String(step).split('.')[1] ?? '').length
  return Number(v.toFixed(Math.min(6, d + 2)))
}

function NumField({ f, value, onChange, disabled }: { f: Extract<Field, { type: 'num' }>; value: number; onChange: (v: number) => void; disabled: boolean }) {
  const scale = f.scale ?? 1
  const shown = round(value * scale, f.step)
  const [draft, setDraft] = useState<string | null>(null)
  const p = Math.min(100, Math.max(0, ((shown - f.min) / (f.max - f.min)) * 100))
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{f.label}</label>
        <div className="relative w-32 shrink-0">
          <input
            inputMode="decimal"
            className="input h-9 pr-8 text-right tnum"
            disabled={disabled}
            value={draft ?? String(shown)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const n = Number((draft ?? '').replace(',', '.'))
              if (draft !== null && Number.isFinite(n)) onChange(n / scale)
              setDraft(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label={f.label}
          />
          {f.unit && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted">{f.unit}</span>}
        </div>
      </div>
      <input type="range" className="stake-range mt-2 w-full" min={f.min} max={f.max} step={f.step} value={Math.min(f.max, Math.max(f.min, shown))} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) / scale)} style={{ ['--p' as string]: `${p}%` }} aria-label={`${f.label} — ползунок`} />
      {f.hint && <p className="mt-1 text-[11px] leading-snug text-subtle">{f.hint}</p>}
    </div>
  )
}

function FieldView({ f, value, onChange, disabled }: { f: Field; value: unknown; onChange: (v: unknown) => void; disabled: boolean }) {
  if (f.type === 'num') return <NumField f={f} value={Number(value ?? 0)} onChange={onChange} disabled={disabled} />
  if (f.type === 'bool')
    return (
      <label className={cn('flex cursor-pointer items-center justify-between gap-3', disabled && 'cursor-not-allowed')}>
        <span>
          <span className="text-sm font-medium">{f.label}</span>
          {f.hint && <span className="mt-0.5 block text-[11px] text-subtle">{f.hint}</span>}
        </span>
        <button type="button" role="switch" aria-checked={Boolean(value)} disabled={disabled} onClick={() => onChange(!value)} className={cn('relative h-6 w-11 shrink-0 rounded-full transition', value ? 'bg-primary' : 'bg-border-strong')}>
          <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', value ? 'left-[22px]' : 'left-0.5')} />
        </button>
      </label>
    )
  if (f.type === 'enum')
    return (
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{f.label}</label>
        <select className="input h-9 w-auto" value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={f.label}>
          {f.options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
    )
  if (f.type === 'text')
    return (
      <div>
        <label className="text-sm font-medium">{f.label}</label>
        <input className="input mt-1.5 h-9" value={String(value ?? '')} maxLength={f.max} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={f.label} />
        {f.hint && <p className="mt-1 text-[11px] text-subtle">{f.hint}</p>}
      </div>
    )
  if (f.type === 'nums' || f.type === 'strs') return <ListField f={f} value={(value as unknown[]) ?? []} onChange={onChange} disabled={disabled} />
  if (f.type !== 'group') return null
  const obj = (value ?? {}) as Json
  const total = f.fields.reduce((s, sub) => s + Number(obj[sub.k] ?? 0), 0)
  return (
    <div className="space-y-4">
      {f.fields.map((sub) => (
        <div key={sub.k}>
          <FieldView f={sub} value={obj[sub.k]} disabled={disabled} onChange={(v) => onChange({ ...obj, [sub.k]: v })} />
          {total > 0 && <div className="mt-0.5 text-right text-[11px] text-muted tnum">≈ {((Number(obj[sub.k] ?? 0) / total) * 100).toFixed(2)}% выпадений</div>}
        </div>
      ))}
    </div>
  )
}

function ListField({ f, value, onChange, disabled }: { f: Extract<Field, { type: 'nums' | 'strs' }>; value: unknown[]; onChange: (v: unknown) => void; disabled: boolean }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <div>
      <label className="text-sm font-medium">{f.label}</label>
      <input
        className="input mt-1.5 h-9 tnum"
        disabled={disabled}
        value={text ?? value.join(', ')}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== null) {
            const parts = text
              .split(/[,;\s]+/)
              .map((s) => s.trim())
              .filter(Boolean)
            onChange(f.type === 'nums' ? parts.map((s) => Number(s.replace(',', '.'))).filter((n) => Number.isFinite(n)) : parts)
          }
          setText(null)
        }}
        aria-label={f.label}
      />
      {f.hint && <p className="mt-1 text-[11px] text-subtle">{f.hint}</p>}
    </div>
  )
}

function SettingCard({ k, value, canEdit, onSaved }: { k: string; value: unknown; canEdit: boolean; onSaved: () => void }) {
  const toast = useToast()
  const section = SECTIONS[k]
  const [draft, setDraft] = useState<Json>(() => structuredClone(value as Json))
  const [raw, setRaw] = useState(!section)
  const [text, setText] = useState(JSON.stringify(value, null, 2))
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty = useMemo(() => (raw ? text !== JSON.stringify(value, null, 2) : JSON.stringify(draft) !== JSON.stringify(value)), [raw, text, draft, value])

  async function save() {
    let parsed: unknown = draft
    if (raw) {
      try {
        parsed = JSON.parse(text)
      } catch {
        setErr('Некорректный JSON')
        return
      }
    }
    setSaving(true)
    setErr(null)
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { key: k, value: parsed } })
      toast.success(`«${section?.title ?? k}» сохранено`)
      onSaved()
    } catch (e) {
      const ae = e as ApiError
      setErr(
        ae.fields
          ? Object.entries(ae.fields)
              .map(([f, m]) => `${f}: ${m}`)
              .join('; ')
          : ae.message,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card flex flex-col p-5" data-testid={`setting-${k}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold">{section?.title ?? k}</div>
          <div className="font-mono text-[11px] text-subtle">{k}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            setRaw((r) => !r)
            setText(JSON.stringify(draft, null, 2))
          }}
          className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition', raw ? 'border-accent/60 text-accent' : 'border-border text-muted hover:text-text')}
          disabled={!section}
          title="Редактировать как JSON"
        >
          <Code2 className="size-3.5" /> JSON
        </button>
      </div>
      {section?.description && <p className="mt-1.5 text-xs leading-relaxed text-muted">{section.description}</p>}
      <div className="mt-4 flex-1 space-y-5">
        {raw || !section ? (
          <textarea className="input h-56 py-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} readOnly={!canEdit} spellCheck={false} aria-label={`Настройка ${k}`} />
        ) : (
          section.fields.map((f) => <FieldView key={f.k} f={f} value={draft[f.k]} disabled={!canEdit} onChange={(v) => setDraft((d) => ({ ...d, [f.k]: v }))} />)
        )}
      </div>
      {err && <div className="mt-3 text-xs text-danger">{err}</div>}
      {canEdit && (
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
            Сохранить
          </Button>
          {dirty && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(structuredClone(value as Json))
                setText(JSON.stringify(value, null, 2))
                setErr(null)
              }}
            >
              <RotateCcw className="size-3.5" /> Отменить
            </Button>
          )}
        </div>
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
  const order = [...Object.keys(SECTIONS).filter((k) => k in data), ...Object.keys(data).filter((k) => !(k in SECTIONS))]
  return (
    <>
      <AdminTitle title="Настройки" description={canEdit ? 'Ползунки и поля ввода; сервер проверяет все значения, изменения пишутся в журнал.' : 'Только просмотр: изменять настройки может superadmin.'} />
      <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {order.map((k) => (
          <SettingCard key={k + JSON.stringify(data[k])} k={k} value={data[k]} canEdit={canEdit} onSaved={reload} />
        ))}
      </div>
    </>
  )
}
