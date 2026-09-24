import 'server-only'
import { getDb } from '../db/client'
import { adminLogs, eventLogs } from '../db/schema'
import type { Executor } from '../db/client'

type Level = 'info' | 'warn' | 'error' | 'security'

/**
 * Application/security event log. Never throws — logging must not break a request.
 * Details must never contain passwords, tokens or secrets.
 */
export async function logEvent(
  event: string,
  opts: { level?: Level; userId?: string | null; ip?: string | null; details?: Record<string, unknown> } = {},
) {
  const level = opts.level ?? 'info'
  const line = { t: new Date().toISOString(), level, event, userId: opts.userId ?? undefined, ...opts.details }
  if (process.env.NODE_ENV !== 'test' && process.env.LOG_CONSOLE !== 'false') (level === 'error' ? console.error : console.log)(JSON.stringify(line))
  try {
    await getDb()
      .insert(eventLogs)
      .values({ level, event, userId: opts.userId ?? null, ip: opts.ip ?? null, details: opts.details ?? null })
  } catch (err) {
    console.error('logEvent failed', (err as Error).message)
  }
}

/** Admin audit record. Written inside the same DB transaction as the admin action. */
export async function logAdmin(
  tx: Executor,
  entry: { adminId: string; action: string; targetType?: string; targetId?: string; details?: Record<string, unknown>; ip?: string },
) {
  await tx.insert(adminLogs).values({
    adminId: entry.adminId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    details: entry.details ?? null,
    ip: entry.ip ?? null,
  })
}
