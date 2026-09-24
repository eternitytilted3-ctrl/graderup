import 'dotenv/config'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { closeDb, getDb } from '../src/server/db/client'

async function main() {
  await migrate(getDb(), { migrationsFolder: './src/server/db/migrations' })
  console.log('✓ migrations applied')
  await closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
