import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover shadow-[0_6px_20px_-8px_rgb(124_92_255/0.7)] disabled:shadow-none',
  secondary: 'bg-card-2 text-text border border-border hover:border-border-strong hover:bg-[#19212f]',
  outline: 'border border-primary/50 text-text hover:bg-primary/10 hover:border-primary',
  ghost: 'text-muted hover:text-text hover:bg-white/[0.04]',
  danger: 'bg-danger/90 text-white hover:bg-danger',
  success: 'bg-success/90 text-[#05140c] hover:bg-success',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2.5',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] font-semibold whitespace-nowrap transition-all duration-150 select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
})
