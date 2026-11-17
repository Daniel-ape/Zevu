// Records the pack size every shop prints in its product names, once a day,
// so the app can warn when a product shrinks while its price per kilo or
// litre goes up (see src/domain/shrink.ts). Kept in public/prices/sizes.json.
//
// Run: npx tsx scripts/record-sizes.ts (the "Record pack sizes" workflow).
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { EVERYDAY, categoryFor } from '../src/domain/categories'
import { updateSizes, type SizeDb } from '../src/domain/shrink'

const DIR = 'public/prices'
const FILE = `${DIR}/sizes.json`
const today = new Date().toISOString().slice(0, 10)
const db: SizeDb = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { since: today, items: {} }

function* prices(): Generator<[string, string, string, number]> {
  for (const f of readdirSync(DIR)) {
    // shops' own sites only (not crowd-sourced Open Prices or leaflet offers)
    if (!f.endsWith('.json') || f.includes('-history') || f.startsWith('op-') || ['leaflets.json', 'offers.json', 'sizes.json'].includes(f)) continue
    const d = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))
    if (!d.retailerId || !Array.isArray(d.prices)) continue
    for (const p of d.prices) if (p.ean && p.name && p.priceCents > 0 && EVERYDAY.has(categoryFor(p.name, d.retailerId))) yield [p.ean, p.name, p.brand ?? '', p.priceCents]
  }
}

updateSizes(db, prices(), today)
// a product not seen for a year is dropped
const cutoff = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
for (const [e, v] of Object.entries(db.items)) if (v.g && v.g < cutoff) delete db.items[e]
// one product per line, so daily changes stay small in git
const keys = Object.keys(db.items).sort()
writeFileSync(FILE, `{"since":${JSON.stringify(db.since)},"items":{\n${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(db.items[k])}`).join(',\n')}\n}}\n`)
console.log(`sizes for ${keys.length} products (since ${db.since})`)
