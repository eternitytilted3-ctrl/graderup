import 'dotenv/config'
import { buildCases } from '../src/server/catalog/cases'
import { importCs2Catalog } from '../src/server/catalog/cs2'
import { closeDb } from '../src/server/db/client'

/**
 * Imports/updates real CS2 skins (names, rarities, Steam CDN images, Skinport RUB prices).
 * `npm run skins:import` — update catalogue & prices
 * `npm run skins:import -- --rebuild-cases` — also rebuild the preset cases from the catalogue
 */
async function main() {
  await importCs2Catalog({ log: (m) => console.log(`· ${m}`) })
  if (process.argv.includes('--rebuild-cases')) console.log(`✓ cases rebuilt: ${(await buildCases()).cases}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await new Promise((r) => setTimeout(r, 300))
    await closeDb()
  })
