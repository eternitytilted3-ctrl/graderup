import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export type MoneyInput = string | number | Decimal

export const D = (v: MoneyInput) => new Decimal(v)

/** Canonical 2-dp string for NUMERIC(18,2) columns. */
export function toMoney(v: MoneyInput, rounding: Decimal.Rounding = Decimal.ROUND_HALF_UP): string {
  return new Decimal(v).toDecimalPlaces(2, rounding).toFixed(2)
}

/** Site currency: coins (C). 1 C = 1 RUB of deposit. */
export const CURRENCY_SYMBOL = 'C'

/** Display formatting (client & server): "1 234 C", "12.50 C". */
export function formatMoney(v: MoneyInput | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const n = new Decimal(v)
  const [int, frac] = n.abs().toFixed(2).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  return `${n.isNegative() ? '−' : ''}${grouped}${frac === '00' ? '' : `.${frac}`}\u00a0${CURRENCY_SYMBOL}`
}
