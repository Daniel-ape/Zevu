// Packs the collected shop prices (public/prices/<shop>.json) into the files
// the app loads, so it doesn't download every shop's whole range at start:
//
//   public/prices/app/core.json     loaded when the app opens: everyday goods
//                                   (food, drugstore, cleaning, pets), every
//                                   product in the catalogue, and everything
//                                   sold by at least two shops (comparable)
//   public/prices/app/rest.json     everything else, loaded when searching
//   public/prices/app/history.json  price history for the core products
//
// Compact format, one array per product:
//   [ean, priceCents, name, brand, image, path-or-url, checkedAt]
// where a link on the shop's own site is stored without its origin (shop.o).
//
// Run: npx tsx scripts/build-price-bundles.ts (the web build does this).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { EVERYDAY, categoryFor } from '../src/domain/categories'

interface Price { ean: string; priceCents: number; checkedAt?: string; name?: string; brand?: string; image?: string; url?: string }
interface ShopFile { retailerId: string; fetchedAt: string; prices: Price[] }
type Item = [string, number, string, string, string, string, string]
interface Shop { r: string; at: string; o: string; i: Item[] }

const DIR = 'public/prices'
const OUT = `${DIR}/app`
const shops: ShopFile[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && !f.includes('-history') && f !== 'leaflets.json')
  .map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as ShopFile)
  .filter((d) => d.retailerId && Array.isArray(d.prices))

const catalogue = new Set<string>(JSON.parse(readFileSync('public/products/fi.json', 'utf8')).rows.map((r: string[]) => r[0]))
// Distinct chains per product (Prisma can come both from prisma.fi and from Open Prices).
const chainsPerEan = new Map<string, Set<string>>()
for (const s of shops) for (const p of s.prices) { const c = chainsPerEan.get(p.ean) ?? new Set(); c.add(s.retailerId); chainsPerEan.set(p.ean, c) }
const shopsPerEan = new Map([...chainsPerEan].map(([e, c]) => [e, c.size]))

const isCore = (p: Price, shop: string) =>
  catalogue.has(p.ean) || (shopsPerEan.get(p.ean) ?? 0) >= 2 || !p.name || EVERYDAY.has(categoryFor(p.name, shop))

const core: Shop[] = []
const rest: Shop[] = []
const coreEans = new Map<string, Set<string>>()
for (const s of shops) {
  const origins = new Map<string, number>()
  for (const p of s.prices) if (p.url?.startsWith('https://')) { const o = new URL(p.url).origin; origins.set(o, (origins.get(o) ?? 0) + 1) }
  const o = [...origins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  const pack = (p: Price): Item => [
    p.ean, p.priceCents, p.name ?? '', p.brand ?? '', p.image?.startsWith('https://') ? p.image : '',
    p.url?.startsWith('https://') ? (o && p.url.startsWith(o + '/') ? p.url.slice(o.length) : p.url) : '',
    (p.checkedAt ?? s.fetchedAt).slice(0, 16),
  ]
  const c: Shop = { r: s.retailerId, at: s.fetchedAt, o, i: [] }
  const r: Shop = { r: s.retailerId, at: s.fetchedAt, o, i: [] }
  const mine = new Set<string>()
  for (const p of s.prices) {
    if (isCore(p, s.retailerId)) { c.i.push(pack(p)); mine.add(p.ean) } else r.i.push(pack(p))
  }
  coreEans.set(s.retailerId, new Set([...(coreEans.get(s.retailerId) ?? []), ...mine]))
  core.push(c)
  rest.push(r)
}

// History for core products only (rest products show their current price).
const history: Record<string, Record<string, [string, number][]>> = {}
for (const s of shops) {
  const file = `${DIR}/${s.retailerId}-history.json`
  if (!existsSync(file) || history[s.retailerId]) continue
  const h = JSON.parse(readFileSync(file, 'utf8')) as Record<string, [string, number][]>
  const keep = coreEans.get(s.retailerId)!
  history[s.retailerId] = Object.fromEntries(Object.entries(h).filter(([e]) => keep.has(e)))
}

mkdirSync(OUT, { recursive: true })
const builtAt = new Date().toISOString()
writeFileSync(`${OUT}/core.json`, JSON.stringify({ builtAt, shops: core }))
writeFileSync(`${OUT}/rest.json`, JSON.stringify({ builtAt, shops: rest }))
writeFileSync(`${OUT}/history.json`, JSON.stringify(history))
const n = (x: Shop[]) => x.reduce((a, s) => a + s.i.length, 0)
const kb = (f: string) => Math.round(readFileSync(`${OUT}/${f}`).length / 1024)
console.log(`core ${n(core)} products (${kb('core.json')} kB), rest ${n(rest)} (${kb('rest.json')} kB), history ${kb('history.json')} kB`)
