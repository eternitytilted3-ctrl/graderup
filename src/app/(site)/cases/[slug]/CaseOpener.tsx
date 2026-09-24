'use client'

import { Coins, PackageCheck, RotateCcw, Zap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { Roulette, type RouletteHandle } from '@/components/domain/Roulette'
import { RarityBadge } from '@/components/domain/RarityBadge'
import { useSession } from '@/components/SessionProvider'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import type { CaseItemDTO, OpenCaseResult } from '@/lib/types'

export function CaseOpener({ caseId, slug, price, items }: { caseId: string; slug: string; price: string; items: CaseItemDTO[] }) {
  const { user, setBalance } = useSession()
  const toast = useToast()
  const roulette = useRef<RouletteHandle>(null)
  const [busy, setBusy] = useState(false)
  const [fast, setFast] = useState(false)
  const [result, setResult] = useState<OpenCaseResult | null>(null)
  const [selling, setSelling] = useState(false)
  const [sold, setSold] = useState(false)

  const insufficient = user ? Number(user.balance) < Number(price) : false

  async function open() {
    if (busy) return
    setBusy(true)
    setResult(null)
    setSold(false)
    try {
      // 1. Server decides the result (and debits the balance) before any animation.
      const r = await api<OpenCaseResult>(`/api/cases/${caseId}/open`, { method: 'POST' })
      setBalance(r.balance)
      // 2. The animation only visualizes the returned result.
      await roulette.current?.spin(r.reel, r.winIndex, { fast })
      setResult(r)
    } catch (err) {
      const e = err as ApiError
      toast.error(e.code === 'INSUFFICIENT_FUNDS' ? 'Недостаточно средств' : 'Не удалось открыть кейс', e.message)
    } finally {
      setBusy(false)
    }
  }

  async function sell() {
    if (!result) return
    setSelling(true)
    try {
      const r = await api<{ balance: string; amount: string }>(`/api/inventory/${result.userItemId}/sell`, { method: 'POST' })
      setBalance(r.balance)
      setSold(true)
      toast.success(`Продано за ${formatMoney(r.amount)}`)
      setResult(null)
    } catch (err) {
      toast.error('Не удалось продать', (err as ApiError).message)
    } finally {
      setSelling(false)
    }
  }

  return (
    <section aria-label="Открытие кейса">
      <Roulette ref={roulette} idleItems={items} />
      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {user ? (
          insufficient && !busy ? (
            <Link href="/deposit" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:min-w-64">
                <Coins className="size-4" /> Пополнить баланс
              </Button>
            </Link>
          ) : (
            <Button size="lg" onClick={open} loading={busy} className="w-full sm:min-w-64" data-testid="open-case">
              {busy ? 'Открываем…' : `Открыть кейс · ${formatMoney(price)}`}
            </Button>
          )
        ) : (
          <Link href={`/login?next=/cases/${slug}`} className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:min-w-64">
              Войдите, чтобы открыть
            </Button>
          </Link>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="size-4 accent-[#7C5CFF]" />
          <Zap className="size-3.5" /> Быстрое открытие
        </label>
      </div>
      {insufficient && user && !busy && <p className="mt-2 text-center text-xs text-muted">На балансе {formatMoney(user.balance)} — не хватает {formatMoney(Number(price) - Number(user.balance))}</p>}

      <Modal open={Boolean(result) && !sold} onClose={() => setResult(null)} title="Ваш дроп" size="sm">
        {result && (
          <div className="flex flex-col items-center text-center" data-rarity={result.item.rarity}>
            <div className="relative flex h-44 w-full items-center justify-center">
              <div className="absolute inset-0 animate-pop rounded-full" style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--r) 45%, transparent), transparent)' }} />
              <Image src={result.item.image} alt={result.item.name} width={200} height={140} className="relative h-32 w-auto animate-pop" />
            </div>
            <RarityBadge rarity={result.item.rarity} />
            <div className="mt-1.5 font-display text-lg font-bold" data-testid="drop-name">
              {result.item.name}
            </div>
            <div className="mt-1 font-display text-2xl font-extrabold tnum">{formatMoney(result.item.price)}</div>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              <Button variant="secondary" onClick={sell} loading={selling}>
                <Coins className="size-4" /> Продать · {formatMoney(result.sellPrice)}
              </Button>
              <Button onClick={() => setResult(null)}>
                <PackageCheck className="size-4" /> В инвентарь
              </Button>
            </div>
            <button onClick={() => { setResult(null); void open() }} className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text">
              <RotateCcw className="size-3.5" /> Открыть ещё раз
            </button>
          </div>
        )}
      </Modal>
    </section>
  )
}
