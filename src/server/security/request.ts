import type { NextRequest } from 'next/server'

/**
 * Client IP. In production the app must sit behind a reverse proxy that OVERWRITES
 * X-Forwarded-For / X-Real-IP with the real peer address (see README → Deployment).
 */
export function clientIp(req: Request | NextRequest): string {
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.slice(0, 64)
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim().slice(0, 64)
  return 'unknown'
}

export function userAgent(req: Request | NextRequest): string {
  return (req.headers.get('user-agent') ?? '').slice(0, 512)
}
