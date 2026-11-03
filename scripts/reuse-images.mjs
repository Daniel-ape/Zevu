// Rebuilds scripts/.image-index.json from the picture files already in
// public/products, so a catalogue rebuild can keep the existing pictures
// without downloading them again.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
const index = {}
for (const f of readdirSync('public/products')) {
  const m = f.match(/^img-(\d+)\.json$/)
  if (!m) continue
  for (const ean of Object.keys(JSON.parse(readFileSync(`public/products/${f}`, 'utf8')))) index[ean] = Number(m[1])
}
writeFileSync('scripts/.image-index.json', JSON.stringify(index))
console.log(`${Object.keys(index).length} existing pictures kept`)
