import 'server-only'
import type { NextRequest } from 'next/server'
import { env } from '@/config/env'
import { Errors } from '../http/errors'
import type { SessionUser } from '../auth/session'

/**
 * Region / age gate hook. Disabled until RESTRICTED_COUNTRIES / COUNTRY_HEADER are configured.
 * ⚠️ Список запрещённых стран и источник геолокации должны быть определены юристом
 * для конкретной юрисдикции оператора.
 */
export function checkRegionRestriction(req: NextRequest, user: SessionUser | null) {
  const cfg = env()
  if (cfg.COUNTRY_HEADER && cfg.RESTRICTED_COUNTRIES.length > 0) {
    const country = (req.headers.get(cfg.COUNTRY_HEADER) ?? '').toUpperCase()
    if (country && cfg.RESTRICTED_COUNTRIES.includes(country)) throw Errors.restricted()
  }
  if (user && cfg.MIN_AGE > 0 && user.birthDate) {
    const age = ageFrom(new Date(user.birthDate))
    if (age < cfg.MIN_AGE) throw Errors.restricted(`Сервис доступен только с ${cfg.MIN_AGE} лет`)
  }
}

export function ageFrom(birth: Date, now = new Date()) {
  let age = now.getUTCFullYear() - birth.getUTCFullYear()
  const m = now.getUTCMonth() - birth.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--
  return age
}
