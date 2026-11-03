// Downloads Finnish products from Open Food Facts into raw.json for
// build-snapshot.ts. Runs in GitHub Actions (workflow "Build catalogue").
// Uses Search-a-licious (deep paging allowed); falls back to the classic search
// split by category, which only serves the first 10 pages of each query.
import { writeFileSync } from 'node:fs'

const UA = 'Hintaopas/0.1 (+https://github.com/Daniel-ape/hintaopas; grocery price comparison)'
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
const add = (ps) => { for (const p of ps ?? []) if (p.code && !byCode.has(p.code)) byCode.set(p.code, p) }

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
const all = [...byCode.values()].sort((a, b) => (b.unique_scans_n ?? 0) - (a.unique_scans_n ?? 0))
writeFileSync('raw.json', JSON.stringify(all))
console.log('raw products', all.length)
