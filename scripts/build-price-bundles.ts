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

interface Price { ean: string; priceCents: number; checkedAt?: string; name?: string; brand?: string; image?: string; url?: string; store?: boolean }
interface ShopFile { retailerId: string; fetchedAt: string; prices: Price[] }
// (an 8th field 1 = not orderable online, sold in the shops only)
type Item = [string, number, string, string, string, string, string] | [string, number, string, string, string, string, string, 1]
// o: the shop's site, links are stored without it; p: the start most picture
// addresses share, stored without it (a picture not starting with "http" gets p in front)
interface Shop { r: string; at: string; o: string; p?: string; i: Item[] }

/** The start shared by most of the shop's picture addresses (they are a large part of the files). */
function imagePrefix(urls: string[]): string {
  const groups = new Map<string, string[]>()
  for (const u of urls) { const k = u.slice(0, 30); groups.set(k, [...(groups.get(k) ?? []), u]) }
  const big = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? []
  if (big.length < 20) return ''
  let pre = big[0]
  for (const u of big) { let i = 0; while (i < pre.length && pre[i] === u[i]) i++; pre = pre.slice(0, i) }
  return pre.slice(0, pre.lastIndexOf('/') + 1)
}

// Names as shops print them: HTML entities decoded, odd spaces removed, and
// ALL-CAPS names (pharmacies) written in normal case.
const ENTITIES: Record<string, string> = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ', '#39': "'" }
const SMALL = new Set(['ja', 'tai', 'ilman', 'with', 'and', 'for', 'och', 'med', 'g', 'kg', 'ml', 'cl', 'dl', 'l', 'kpl', 'cm', 'mm', 'm', 'x', 'st', 'pss', 'rll'])
export function cleanName(raw: string): string {
  let n = raw.replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCharCode(+e.slice(1)) : m))
  n = n.replace(/[\u00a0\s]+/g, ' ').trim()
  const letters = n.replace(/[^A-Za-zÅÄÖåäöÉéÜü]/g, '')
  if (letters.length >= 4 && letters === letters.toUpperCase()) {
    n = n.split(' ').map((w, i) => {
      if (/\d/.test(w)) return w // codes and sizes as printed ("7,5CMX4,5M", "V392")
      const lw = w.toLowerCase()
      if (i > 0 && SMALL.has(lw)) return lw
      return lw.charAt(0).toUpperCase() + lw.slice(1)
    }).join(' ')
  }
  return n
}

// How many pieces a name says the pack has ("24 rullaa", "10-PACK", "2 kpl").
const packOf = (name: string) => {
  const m = name.match(/(\d+)\s*-?\s*(kpl|rullaa|rll|pack|paria|pss|st|tabl|kaps|annosta|x)\b/i)
  return m ? +m[1] : 1
}

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

// Same barcode, very different price: usually one shop sells a multipack under
// the single item's barcode ("24 rullaa" vs "1 kpl"). Leave the bigger pack out
// of that product so the comparison isn't between different amounts.
const offers = new Map<string, { shop: string; p: Price }[]>()
for (const s of shops) for (const p of s.prices) { const a = offers.get(p.ean) ?? []; a.push({ shop: s.retailerId, p }); offers.set(p.ean, a) }
const dropped = new Set<Price>()
for (const list of offers.values()) {
  if (list.length < 2) continue
  const prices = list.map((x) => x.p.priceCents)
  if (Math.max(...prices) < 2.5 * Math.min(...prices)) continue
  const packs = list.map((x) => packOf(x.p.name ?? ''))
  const small = Math.min(...packs)
  const min = Math.min(...prices)
  if (Math.max(...packs) > small) list.forEach((x, k) => { if (packs[k] > small) dropped.add(x.p) })
  // Four times the price or more for the "same" item is a pack the name doesn't reveal.
  else if (Math.max(...prices) >= 4 * min) list.forEach((x) => { if (x.p.priceCents >= 2.5 * min) dropped.add(x.p) })
}
for (const s of shops) s.prices = s.prices.filter((p) => !dropped.has(p))
console.log(`left out ${dropped.size} multipack prices sold under a single item's barcode`)

const isCore = (p: Price, shop: string) =>
  catalogue.has(p.ean) || (shopsPerEan.get(p.ean) ?? 0) >= 2 || !p.name || EVERYDAY.has(categoryFor(cleanName(p.name), shop))

const core: Shop[] = []
const rest: Shop[] = []
const coreEans = new Map<string, Set<string>>()
for (const s of shops) {
  const origins = new Map<string, number>()
  for (const p of s.prices) if (p.url?.startsWith('https://')) { const o = new URL(p.url).origin; origins.set(o, (origins.get(o) ?? 0) + 1) }
  const o = [...origins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  const ip = imagePrefix(s.prices.map((p) => p.image ?? '').filter((u) => u.startsWith('https://')))
  const pack = (p: Price): Item => [
    p.ean, p.priceCents, cleanName(p.name ?? ''), cleanName(p.brand ?? ''), p.image?.startsWith('https://') ? (ip && p.image.startsWith(ip) ? p.image.slice(ip.length) : p.image) : '',
    p.url?.startsWith('https://') ? (o && p.url.startsWith(o + '/') ? p.url.slice(o.length) : p.url) : '',
    (p.checkedAt ?? s.fetchedAt).slice(0, 16),
    ...(p.store ? [1 as const] : []),
  ] as Item
  const c: Shop = { r: s.retailerId, at: s.fetchedAt, o, ...(ip ? { p: ip } : {}), i: [] }
  const r: Shop = { r: s.retailerId, at: s.fetchedAt, o, ...(ip ? { p: ip } : {}), i: [] }
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
// Cheapest price per barcode, split by the barcode's last two digits, for the
// installed app's background price check (public/runners/background.js): it
// fetches only the few small files its watched products are in.
const best = new Map<string, [number, string]>()
for (const s of shops) for (const p of s.prices) { const b = best.get(p.ean); if (!b || p.priceCents < b[0]) best.set(p.ean, [p.priceCents, s.retailerId]) }
mkdirSync(`${OUT}/best`, { recursive: true })
const shards = new Map<string, Record<string, [number, string]>>()
for (const [ean, v] of best) { const k = ean.slice(-2).padStart(2, '0'); if (!shards.has(k)) shards.set(k, {}); shards.get(k)![ean] = v }
for (let i = 0; i < 100; i++) { const k = String(i).padStart(2, '0'); writeFileSync(`${OUT}/best/${k}.json`, JSON.stringify(shards.get(k) ?? {})) }
const n = (x: Shop[]) => x.reduce((a, s) => a + s.i.length, 0)
const kb = (f: string) => Math.round(readFileSync(`${OUT}/${f}`).length / 1024)
console.log(`core ${n(core)} products (${kb('core.json')} kB), rest ${n(rest)} (${kb('rest.json')} kB), history ${kb('history.json')} kB`)
