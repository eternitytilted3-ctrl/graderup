import { cn } from '@/lib/cn'

/** Site coin glyph (1 C = 1 ₽ of deposit). Inherits the text colour. */
export function Coin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={cn('inline-block size-[1em] shrink-0', className)}>
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <circle cx="10" cy="10" r="6.6" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="1.2" />
      <path d="M12.9 7.4A3.6 3.6 0 1 0 12.9 12.6" fill="none" stroke="#000" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Amount + coin glyph: "1 234 ⛁". */
export function CoinAmount({ value, className, iconClassName }: { value: string; className?: string; iconClassName?: string }) {
  const n = Number(value)
  const text = (Number.isInteger(n) ? n.toString() : n.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (
    <span className={cn('inline-flex items-center gap-1 tnum', className)}>
      {text}
      <Coin className={cn('text-[#d9dde4]', iconClassName)} />
      <span className="sr-only">C</span>
    </span>
  )
}
