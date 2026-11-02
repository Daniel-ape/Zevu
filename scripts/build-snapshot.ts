// Turns an Open Food Facts export (raw.json) into public/products/fi.json.
// Usage: npx tsx scripts/build-snapshot.ts path/to/raw.json
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { toProduct, type OffProduct } from '../src/data/openFoodFacts'

const raw: OffProduct[] = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const images: Record<string, number> = existsSync('scripts/.image-index.json')
  ? JSON.parse(readFileSync('scripts/.image-index.json', 'utf8'))
  : {}
const seen = new Set<string>()
const rows = []
for (const p of raw) {
  const fi = toProduct(p, 'fi')
  if (!fi || seen.has(fi.ean) || !/^\d{8,14}$/.test(fi.ean)) continue
  seen.add(fi.ean)
  const sv = p.product_name_sv?.trim() ?? ''
  rows.push([fi.ean, fi.name, sv === fi.name ? '' : sv, fi.brand, p.quantity ?? '', fi.category, fi.emoji, images[fi.ean] ?? -1])
}
mkdirSync('public/products', { recursive: true })
writeFileSync('public/products/fi.json', JSON.stringify({
  source: 'Open Food Facts (https://world.openfoodfacts.org), ODbL licence',
  builtAt: new Date().toISOString(),
  rows,
}))
console.log(`${rows.length} products, ${rows.filter((r) => r[7] !== -1).length} with pictures`)
