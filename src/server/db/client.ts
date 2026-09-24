import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export type DB = NodePgDatabase<typeof schema>
/** A Drizzle transaction handle (same query API as DB). */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]
export type Executor = DB | Tx

const globalForDb = globalThis as unknown as { __graderupPool?: Pool; __graderupDb?: DB }

function createPool(url: string) {
  return new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 20),
    idleTimeoutMillis: 30_000,
    // Fail fast instead of hanging if the pool is exhausted.
    connectionTimeoutMillis: 10_000,
    // Upper bound for row-lock waits inside game/money transactions.
    options: '-c lock_timeout=10000 -c statement_timeout=30000' })
}

/** Lazily created singleton (survives Next.js dev hot reloads). */
export function getDb(): DB {
  if (!globalForDb.__graderupDb) {
    const url = process.env.DATABASE_URL ?? 'postgres://graderup:graderup@localhost:5432/graderup'
    globalForDb.__graderupPool = createPool(url)
    globalForDb.__graderupDb = drizzle(globalForDb.__graderupPool, { schema })
  }
  return globalForDb.__graderupDb
}

export async function closeDb() {
  await globalForDb.__graderupPool?.end()
  globalForDb.__graderupPool = undefined
  globalForDb.__graderupDb = undefined
}

export { schema }
