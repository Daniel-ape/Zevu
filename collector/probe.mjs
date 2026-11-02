import { readFileSync } from 'node:fs'
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA } }); return [r.status, await r.text()] }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const eans = new Set(JSON.parse(readFileSync('collector/fi-snapshot.json', 'utf8')).rows.map((r) => r[0]))
let all = []
for (const n of [1, 2, 3]) {
  const [, xml] = await get(`https://www.tokmanni.fi/sitemap/sitemap-1-${n}.xml`)
  all = all.concat([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))
  await sleep(10000)
}
const byEan = new Map()
for (const u of all) { const m = u.match(/-(\d{8}|\d{13})$/); if (m) byEan.set(m[1], u) }
const hits = [...byEan.keys()].filter((e) => eans.has(e))
console.log('products with EAN in url', byEan.size, 'matching our snapshot', hits.length)
const sample = hits.slice(0, 2).map((e) => byEan.get(e))
for (const u of sample) {
  await sleep(10000)
  const [st, html] = await get(u)
  console.log('\nPRODUCT', u, st)
  console.log('ld+json:', [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1].slice(0, 700)))
  console.log('price attrs:', [...html.matchAll(/data-price-amount="([^"]+)"|"finalPrice":\{"amount":([\d.]+)|itemprop="price" content="([^"]+)"/g)].map((m) => m[0]).slice(0, 6))
}
