// TEMPORARY: can Power's product prices be read (sitemap → product page → JSON-LD with EAN and price)?
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(u) {
  await sleep(1500)
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) })
  const t = await r.text(); console.log(`-- ${r.status} ${t.length}b ${u}`); return r.ok ? t : ''
}
const locs = (x) => [...x.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1])
const root = await get('https://www.power.fi/services/sitemap.xml')
const maps = locs(root); console.log('child sitemaps', maps.length, maps.slice(0, 12))
const prodMap = maps.find((u) => /product/i.test(u)) ?? maps[0]
const urls = prodMap ? locs(await get(prodMap)) : []
console.log('urls in first product map', urls.length, urls.slice(0, 5))
for (const u of urls.filter((_, i) => i % 50 === 3).slice(0, 3)) {
  const h = await get(u)
  const ld = [...h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1].slice(0, 700))
  console.log('ld+json blocks', ld.length); for (const b of ld) console.log('  ', b.replace(/\s+/g, ' ').slice(0, 600))
  console.log('gtin/ean hints', (h.match(/"(gtin13|gtin|ean|EAN)"\s*:\s*"?\d{8,14}/g) || []).slice(0, 3), 'price hints', (h.match(/"(price|salesPrice|currentPrice)"\s*:\s*"?[\d.]+/g) || []).slice(0, 3))
}
