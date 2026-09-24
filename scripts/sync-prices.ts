import 'dotenv/config'
import { closeDb } from '../src/server/db/client'
import { syncPrices } from '../src/server/pricing/sync'

/** Cron-friendly: `npm run prices:sync` (add `-- --dry-run` to preview). */
syncPrices({ dryRun: process.argv.includes('--dry-run') })
  .then((r) => console.log(JSON.stringify({ ...r, changes: r.changes.length }, null, 2)))
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await new Promise((r) => setTimeout(r, 300))
    await closeDb()
  })
