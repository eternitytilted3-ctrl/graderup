/* eslint-disable @next/next/no-img-element */
const palette = ['#7C5CFF', '#00D4FF', '#35D07F', '#FFB547', '#FF5570', '#9B6BFF', '#36D6A8']

export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  if (src) return <img src={src} alt="" width={size} height={size} className="rounded-full object-cover ring-1 ring-border" style={{ width: size, height: size }} />
  const color = palette[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length]
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-display font-bold text-white uppercase ring-1 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, ${color}, #111722 140%)` }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  )
}
