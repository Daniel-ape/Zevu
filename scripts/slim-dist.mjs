// The phone apps only read the prepared price bundles (prices/app/), the
// leaflet feed and the offers; the raw per-shop files (over 100 MB) are for
// building those and for the website. Leaving them out of the apps makes them
// much smaller to download and install and quicker to start.
import { readdirSync, rmSync } from 'node:fs'

const KEEP = new Set(['leaflets.json', 'offers.json'])
let removed = 0
for (const f of readdirSync('dist/prices')) {
  if (f.endsWith('.json') && !KEEP.has(f)) { rmSync(`dist/prices/${f}`); removed++ }
}
console.log(`removed ${removed} raw price files from the app build`)
