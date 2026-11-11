// Downloads Finnish products from Open Food Facts into raw.json for
// build-snapshot.ts. Runs in GitHub Actions (workflow "Build catalogue").
// Uses Search-a-licious (deep paging allowed); falls back to the classic search
// split by category, which only serves the first 10 pages of each query.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'

const UA = 'Hintaopas/0.1 (+https://github.com/Daniel-ape/zevu; grocery price comparison)'
const FIELDS = 'code,product_name,product_name_fi,product_name_sv,product_name_en,brands,quantity,categories_tags,image_front_small_url,unique_scans_n'
const MAX = Number(process.argv[2] ?? 8000)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (url) => {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null)
    if (r?.ok) return r.json()
    console.log('retry', r?.status, url.slice(0, 120))
    await sleep(15000)
  }
  return null
}

const byCode = new Map()
// Search-a-licious returns some text fields as lists; the app expects text.
const text = (v) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : undefined)
const clean = (p) => ({
  ...p,
  code: String(p.code ?? ''),
  product_name: text(p.product_name), product_name_fi: text(p.product_name_fi), product_name_sv: text(p.product_name_sv),
  product_name_en: text(p.product_name_en), brands: text(p.brands), quantity: text(p.quantity),
  categories_tags: Array.isArray(p.categories_tags) ? p.categories_tags : [],
  image_front_small_url: text(p.image_front_small_url),
})
const add = (ps) => { for (const p of ps ?? []) if (p.code && !byCode.has(String(p.code))) byCode.set(String(p.code), clean(p)) }

// 1. Search-a-licious
for (let page = 1; byCode.size < MAX; page++) {
  const d = await get(`https://search.openfoodfacts.org/search?q=${encodeURIComponent('countries_tags:"en:finland"')}&page_size=100&page=${page}&sort_by=-unique_scans_n&fields=${FIELDS}`)
  const hits = d?.hits ?? []
  if (page === 1) console.log('search-a-licious count', d?.count, 'first', hits.length)
  add(hits)
  if (hits.length < 100) break
  await sleep(1500)
}
console.log('after search-a-licious', byCode.size)

// 2. Fallback: classic search, one query per category (10 pages each).
if (byCode.size < MAX / 2) {
  const cats = ['dairies', 'cheeses', 'yogurts', 'breads', 'meats', 'fishes', 'beverages', 'coffees', 'teas', 'juices', 'snacks', 'sweet-snacks',
    'chocolates', 'candies', 'biscuits', 'breakfast-cereals', 'pastas', 'rices', 'sauces', 'condiments', 'frozen-foods', 'fruits', 'vegetables',
    'plant-based-foods', 'meals', 'sausages', 'spreads', 'soups', 'baby-foods', 'desserts', 'ice-creams', 'cooking-helpers', 'flours', 'oils']
  for (const c of cats) {
    for (let page = 1; page <= 10; page++) {
      const d = await get(`https://world.openfoodfacts.org/api/v2/search?countries_tags=en:finland&categories_tags=en:${c}&page_size=100&page=${page}&sort_by=unique_scans_n&fields=${FIELDS}`)
      add(d?.products)
      if (!d || (d.products ?? []).length < 100) break
      await sleep(7000)
    }
    console.log(c, byCode.size)
    if (byCode.size >= MAX) break
  }
}
// 3. Barcodes the shops sell (public/prices/<shop>.json) that the Finnish list
// above doesn't have: look them up, so they get proper names (also Swedish),
// pictures, sizes and categories. 100 codes per query.
const shopEans = new Set()
if (existsSync('public/prices')) {
  for (const f of readdirSync('public/prices')) {
    if (!f.endsWith('.json') || f.includes('-history') || f === 'leaflets.json') continue
    try { for (const p of JSON.parse(readFileSync(`public/prices/${f}`, 'utf8')).prices ?? []) if (/^\d{8,14}$/.test(p.ean) && !byCode.has(p.ean)) shopEans.add(p.ean) } catch { /* not a price file */ }
  }
}
const codes = [...shopEans]
console.log('shop barcodes not in the list', codes.length)
const before = byCode.size
for (let i = 0; i < codes.length; i += 100) {
  const d = await get(`https://world.openfoodfacts.org/api/v2/search?code=${codes.slice(i, i + 100).join(',')}&page_size=100&fields=${FIELDS}`)
  // Only real products with a name; marked so they sort after the Finnish favourites.
  add((d?.products ?? []).filter((p) => p.product_name || p.product_name_fi || p.product_name_sv).map((p) => ({ ...p, unique_scans_n: p.unique_scans_n ?? 0 })))
  await sleep(6500)
}
console.log('found in Open Food Facts', byCode.size - before)

const all = [...byCode.values()].sort((a, b) => (b.unique_scans_n ?? 0) - (a.unique_scans_n ?? 0))
writeFileSync('raw.json', JSON.stringify(all))
console.log('raw products', all.length)
