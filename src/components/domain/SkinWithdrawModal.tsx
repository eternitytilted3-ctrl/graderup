'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import type { InventoryItemDTO } from '@/lib/types'
import { RarityBadge } from './RarityBadge'

/** Asks for the Steam trade URL (saved to the profile) and starts a skin withdrawal. */
export function SkinWithdrawModal({ entry, onClose, onDone }: { entry: InventoryItemDTO | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [tradeUrl, setTradeUrl] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (!entry) return
    api<{ tradeUrl: string | null; config: { enabled: boolean } }>('/api/skins/withdrawals')
      .then((r) => {
        setTradeUrl(r.tradeUrl ?? '')
        setEnabled(r.config.enabled)
      })
      .catch(() => setEnabled(false))
  }, [entry])

  async function submit() {
    if (!entry) return
    setLoading(true)
    setErr(null)
    try {
      await api('/api/profile/trade-url', { method: 'PUT', body: { tradeUrl: tradeUrl.trim() } })
      await api('/api/skins/withdrawals', { body: { userItemId: entry.id } })
      toast.success('Вывод создан', 'Ищем продавца — статус на странице «Вывод» → «Скины в Steam»')
      onDone()
    } catch (e) {
      const ae = e as ApiError
      setErr(ae.fields?.tradeUrl ?? ae.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={Boolean(entry)} onClose={onClose} title="Вывод скина в Steam" size="sm">
      {entry && (
        <div className="space-y-4" data-rarity={entry.item.rarity}>
          <div className="slot-bg flex items-center gap-3 rounded-[var(--radius-md)] border border-border p-3">
            <Image src={entry.item.image} alt="" width={120} height={84} className="h-14 w-auto object-contain" />
            <div className="min-w-0">
              <RarityBadge rarity={entry.item.rarity} />
              <div className="truncate text-sm font-semibold">{entry.item.name}</div>
              <div className="text-xs text-muted tnum">{formatMoney(entry.item.price)}</div>
            </div>
          </div>
          {enabled === false ? (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">Вывод скинов сейчас недоступен. Попробуйте позже.</p>
          ) : (
            <>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Ссылка на обмен Steam</span>
                <input className="input text-xs" value={tradeUrl} onChange={(e) => setTradeUrl(e.target.value)} placeholder="https://steamcommunity.com/tradeoffer/new/?partner=…&token=…" data-testid="trade-url" />
                <span className="mt-1 block text-xs text-muted">
                  Найти ссылку:{' '}
                  <Link href="https://steamcommunity.com/my/tradeoffers/privacy#trade_offer_access_url" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Steam → Предложения обмена → Кто может отправлять
                  </Link>
                  . Инвентарь Steam должен быть открытым.
                </span>
              </label>
              {err && (
                <div role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {err}
                </div>
              )}
              <p className="text-xs text-muted">Мы найдём продавца, он отправит вам трейд — примите его в Steam. Пока идёт вывод, предмет заблокирован; при неудаче он вернётся в инвентарь.</p>
              <Button className="w-full" size="lg" onClick={submit} loading={loading} disabled={enabled === null} data-testid="confirm-skin-withdraw">
                Вывести в Steam
              </Button>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
