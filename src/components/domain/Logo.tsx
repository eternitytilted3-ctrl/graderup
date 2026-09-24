import Link from 'next/link'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="GraderUP — на главную">
      <svg viewBox="0 0 64 64" className="size-8 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7C5CFF" />
            <stop offset="1" stopColor="#00D4FF" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="14" fill="#111722" stroke="url(#lg)" strokeWidth="3" />
        <path d="M32 14 L48 32 H38 V50 H26 V32 H16 Z" fill="url(#lg)" />
      </svg>
      {!compact && (
        <span className="font-display text-[21px] font-bold tracking-wide uppercase italic">
          Grader<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">UP</span>
        </span>
      )}
    </Link>
  )
}
