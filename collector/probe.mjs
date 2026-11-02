const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA } }); return [r.status, await r.text()] }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let all = []
for (const n of [1, 2, 3]) {
  const [st, xml] = await get(`https://www.tokmanni.fi/sitemap/sitemap-1-${n}.xml`)
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  console.log('sitemap', n, st, locs.length, locs.filter((u, i) => i % Math.max(1, Math.floor(locs.length / 12)) === 0).slice(0, 12))
  all = all.concat(locs)
  await sleep(10000)
}
const food = all.filter((u) => /maito|kahvi|leipa|juusto|jogurtti|mehu|suklaa|keksi|pasta|riisi/.test(u))
console.log('total', all.length, 'food-ish', food.length, food.slice(0, 10))
const sample = food[0] || all.find((u) => !/\/(c|category)\//.test(u))
const [st, html] = await get(sample)
console.log('\nPRODUCT', sample, st)
console.log('ld+json:', [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1].slice(0, 900)))
console.log('gtin/ean hits:', [...html.matchAll(/(gtin13|"ean"|EAN)[^<]{0,80}/gi)].map((m) => m[0]).slice(0, 5))
console.log('price hits:', [...html.matchAll(/("price"|price-amount|data-price-amount)[^<]{0,80}/gi)].map((m) => m[0]).slice(0, 5))
