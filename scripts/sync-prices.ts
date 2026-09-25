import 'dotenv/config'
import { closeDb } from '../src/server/db/client'
import { syncPrices } from '../src/server/pricing/sync'

/**
 * Cron-friendly: `npm run prices:sync` (add `-- --dry-run` to preview).
 * `-- --provider=auto` forces a provider; `-- --reestimate` re-prices items the market did not price.
 */
const provider = process.argv.find((a) => a.startsWith('--provider='))?.split('=')[1]
syncPrices({ dryRun: process.argv.includes('--dry-run'), provider, reestimate: process.argv.includes('--reestimate') })
  .then((r) => console.log(JSON.stringify({ ...r, changes: r.changes.length }, null, 2)))
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await new Promise((r) => setTimeout(r, 300))
    await closeDb()
  })
