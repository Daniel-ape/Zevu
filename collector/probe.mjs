const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }); return { s: r.status, t: await r.text() } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
console.log('=== Open Prices')
for (const q of ['location__osm_address_country_code=FI', 'location_osm_address_country_code=FI', 'location__osm_address_country=Finland', 'currency=EUR&location__osm_address_country_code=FI&order_by=-date']) {
  const r = await get('https://prices.openfoodfacts.org/api/v1/prices?size=5&' + q)
  let j; try { j = JSON.parse(r.t) } catch {}
  console.log(q, r.s, 'total', j?.total, j?.items?.slice(0, 3).map((x) => [x.product_code, x.price, x.currency, x.date, x.location?.osm_name, x.location?.osm_address_city, x.location?.osm_address_country_code]))
  await sleep(1500)
}
const loc = await get('https://prices.openfoodfacts.org/api/v1/locations?size=50&osm_address_country_code=FI')
try { const j = JSON.parse(loc.t); console.log('locations', loc.s, j.total, j.items?.slice(0, 20).map((x) => [x.osm_name, x.osm_address_city, x.price_count])) } catch { console.log('locations', loc.s, loc.t.slice(0, 200)) }
console.log('=== Minimani')
const sm = await get('https://www.minimani.fi/pub/sitemap/sitemap_001.xml')
const locs = [...sm.t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => /\.html$/.test(u))
console.log('pages', locs.length)
for (const u of locs.filter((u) => /maito|juusto|kahvi|leipa|jogurtti|makkara|mehu/.test(u)).slice(0, 3)) {
  await sleep(3000); const p = await get(u)
  const ld = [...p.t.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join(' ').slice(0, 600)
  console.log(u, p.s, 'sku/gtin:', ld.match(/"(sku|gtin\d*|mpn)"\s*:\s*"?([^",}]+)/g), 'digits13:', [...new Set(p.t.match(/\b(64|73|40|50|87|80|57|59|76|30|54|90)\d{11}\b/g) || [])].slice(0, 5))
}
console.log('=== Fiksuruoka')
for (const u of ['https://kauppa.fiksuruoka.fi/product/19157/maille-dijon-original-sinappi-1kg']) {
  const p = await get(u)
  console.log(u, p.s, 'ean-ish:', [...new Set(p.t.match(/\b\d{13}\b/g) || [])].slice(0, 5), 'price:', p.t.match(/(\d+[,.]\d{2})\s*(€|&euro;)/)?.[0], 'ld:', /ld\+json/.test(p.t))
}
