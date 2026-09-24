import 'server-only'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '../db/client'
import { idempotencyKeys } from '../db/schema'
import { Errors } from './errors'

const KEY_RE = /^[A-Za-z0-9_-]{8,100}$/

/**
 * Replays the stored response for a repeated Idempotency-Key instead of executing twice.
 * The DB-level locks in the services are the real guarantee against double spending;
 * this layer makes retries (double clicks, flaky networks) return the original result.
 */
export async function withIdempotency(userId: string, scope: string, key: string, run: () => Promise<Response>): Promise<Response> {
  if (!KEY_RE.test(key)) throw Errors.badRequest('Некорректный Idempotency-Key')
  const db = getDb()
  const inserted = await db
    .insert(idempotencyKeys)
    .values({ userId, scope, key })
    .onConflictDoNothing()
    .returning({ id: idempotencyKeys.id })

  if (inserted.length === 0) {
    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)))
    if (existing?.statusCode) {
      const res = NextResponse.json(existing.response, { status: existing.statusCode })
      res.headers.set('Idempotent-Replayed', 'true')
      return res
    }
    throw Errors.conflict('Запрос уже обрабатывается', 'REQUEST_IN_PROGRESS')
  }

  const id = inserted[0].id
  let res: Response
  try {
    res = await run()
  } catch (err) {
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.id, id))
    throw err
  }
  if (res.status >= 500) {
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.id, id))
    return res
  }
  const payload = await res.clone().json().catch(() => null)
  await db.update(idempotencyKeys).set({ statusCode: res.status, response: payload }).where(eq(idempotencyKeys.id, id))
  return res
}
