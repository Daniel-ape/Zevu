// Prices from Open Prices (prices.openfoodfacts.org), Open Food Facts' open
// database of prices people report from receipts and shelf labels (ODbL).
// It's the only open source of S-group, K-group and Lidl shelf prices.
// Everything within Finland is fetched (a circle over the country, then only
// locations in FI) and written per chain: public/prices/op-<retailer>.json.
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs'

const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const API = 'https://prices.openfoodfacts.org/api/v1/prices'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// OSM brand / name → the app's retailer
const CHAINS = [
  [/k-?\s?citymarket/i, 'k-citymarket'], [/k-?\s?supermarket/i, 'k-supermarket'], [/k-?\s?market/i, 'k-market'],
  [/prisma/i, 'prisma'], [/s-?\s?market/i, 's-market'], [/\bsale\b/i, 'sale'], [/alepa/i, 'alepa'],
  [/lidl/i, 'lidl'], [/tokmanni/i, 'tokmanni'], [/halpa-?halli/i, 'halpahalli'],
]
const chainOf = (loc) => CHAINS.find(([re]) => re.test(`${loc?.osm_brand ?? ''} ${loc?.osm_name ?? ''}`))?.[1]

const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
const byChain = new Map()
let page = 1, pages = 1, seen = 0
while (page <= pages && page <= 200) {
  const url = `${API}?lat=64&lon=25.5&radius_km=600&currency=EUR&date__gte=${since}&order_by=-date&size=100&page=${page}`
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
  if (!r.ok) { console.log('stopped', r.status, url); break }
  const j = await r.json()
  pages = j.pages ?? 1
  for (const x of j.items ?? []) {
    seen++
    const loc = x.location
    if (loc?.osm_address_country_code !== 'FI' || !/^\d{8,14}$/.test(x.product_code ?? '')) continue
    const retailer = chainOf(loc)
    if (!retailer || !(x.price > 0)) continue
    const ean = x.product_code.length === 12 ? '0' + x.product_code : x.product_code
    const m = byChain.get(retailer) ?? new Map()
    const prev = m.get(ean)
    // newest report per product and chain
    if (!prev || x.date > prev.date) m.set(ean, { ean, priceCents: Math.round(x.price * 100), checkedAt: `${x.date}T12:00:00.000Z`, date: x.date, city: loc.osm_address_city ?? '' })
    byChain.set(retailer, m)
  }
  page++
  await sleep(1000)
}

mkdirSync('public/prices', { recursive: true })
for (const f of readdirSync('public/prices')) if (/^op-.*\.json$/.test(f)) unlinkSync(`public/prices/${f}`)
let total = 0
for (const [retailer, m] of byChain) {
  const prices = [...m.values()].map(({ date, city, ...p }) => p).sort((a, b) => a.ean.localeCompare(b.ean))
  total += prices.length
  const head = JSON.stringify({ source: 'Open Prices (prices.openfoodfacts.org), ODbL', retailerId: retailer, fetchedAt: new Date().toISOString() }).slice(0, -1)
  writeFileSync(`public/prices/op-${retailer}.json`, `${head},"prices":[\n${prices.map((p) => JSON.stringify(p)).join(',\n')}\n]}\n`)
}
console.log(`read ${seen} prices, kept ${total} Finnish prices from ${byChain.size} chains:`, [...byChain].map(([k, v]) => `${k} ${v.size}`).join(', '))
