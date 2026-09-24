import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
export const hmacSha256 = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex')

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/** Cryptographically secure uniform integer in [0, max). The only RNG used for game outcomes. */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new Error('secureRandomInt: max must be a positive integer')
  return randomInt(max)
}
