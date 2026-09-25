/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/cn'

/** Built-in crate art: `/assets/cases/<slug>.svg` has 3D face textures in `/assets/cases/3d/`. */
const BUILTIN = /^\/assets\/cases\/([a-z0-9-]+)\.svg$/

export const has3D = (image: string) => BUILTIN.test(image)

/**
 * CSS-3D crate: a real box (front / top / sides / back) in perspective, gently swaying; parents can
 * tilt it on hover via `.crate3d-box` rules. Sized by its container (all lengths in cqw), so it
 * fits any tile. Custom uploaded case images fall back to a flat <img>.
 */
export function Crate3D({ image, alt, className, delay = 0, still = false }: { image: string; alt: string; className?: string; delay?: number; still?: boolean }) {
  const m = BUILTIN.exec(image)
  if (!m) {
    return (
      <div className={cn('crate3d', className)}>
        <img src={image} alt={alt} className="relative w-[88%] object-contain drop-shadow-[0_14px_20px_rgba(0,0,0,0.45)]" draggable={false} />
      </div>
    )
  }
  const base = `/assets/cases/3d/${m[1]}`
  return (
    <div className={cn('crate3d', className)} role="img" aria-label={alt}>
      <div className="crate3d-shadow" />
      <div className={cn('crate3d-sway', still && 'crate3d-still')} style={{ animationDelay: `${-delay}s` }}>
        <div className="crate3d-box">
          <div className="crate3d-face crate3d-front" style={{ backgroundImage: `url(${base}-front.svg)` }} />
          <div className="crate3d-face crate3d-back" />
          <div className="crate3d-face crate3d-right" style={{ backgroundImage: `url(${base}-side.svg)` }} />
          <div className="crate3d-face crate3d-left" style={{ backgroundImage: `url(${base}-side.svg)` }} />
          <div className="crate3d-face crate3d-top" style={{ backgroundImage: `url(${base}-top.svg)` }} />
          <div className="crate3d-face crate3d-bottom" />
        </div>
      </div>
    </div>
  )
}
