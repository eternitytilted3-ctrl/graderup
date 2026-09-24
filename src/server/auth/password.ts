import 'server-only'
import { hash, verify } from '@node-rs/argon2'

// argon2id (library default) with OWASP-recommended parameters.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 }

export const hashPassword = (password: string) => hash(password, OPTIONS)

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

let dummyHash: string | null = null
/** Burns comparable CPU time for unknown accounts (mitigates user enumeration via timing). */
export async function verifyDummy(password: string) {
  dummyHash ??= await hashPassword('dummy-password-for-timing')
  await verifyPassword(dummyHash, password)
  return false
}
