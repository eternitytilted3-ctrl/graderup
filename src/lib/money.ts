import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export type MoneyInput = string | number | Decimal

export const D = (v: MoneyInput) => new Decimal(v)

/** Canonical 2-dp string for NUMERIC(18,2) columns. */
export function toMoney(v: MoneyInput, rounding: Decimal.Rounding = Decimal.ROUND_HALF_UP): string {
  return new Decimal(v).toDecimalPlaces(2, rounding).toFixed(2)
}

/** Display formatting (client & server). */
export function formatMoney(v: MoneyInput | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const n = new Decimal(v)
  const [int, frac] = n.toFixed(2).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `$${grouped}.${frac}`
}
