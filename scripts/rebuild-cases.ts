import 'dotenv/config'
import { buildCases } from '../src/server/catalog/cases'
import { closeDb } from '../src/server/db/client'

/** Recomputes every preset case (contents + drop weights for the configured RTP) from current item prices. */
buildCases()
  .then((r) => console.log(`✓ cases rebuilt from current prices: ${r.cases}`))
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await new Promise((r) => setTimeout(r, 300))
    await closeDb()
  })
