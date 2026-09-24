import 'dotenv/config'
import { Client } from 'pg'

/** Drops and recreates the public schema. Refuses to run in production. */
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('db:reset is disabled in production')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;')
  await client.end()
  console.log('✓ database reset')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
