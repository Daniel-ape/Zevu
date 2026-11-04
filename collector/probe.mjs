const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }); return { s: r.status, t: await r.text() } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (const q of ['lat=63.5&lon=25.5&radius_km=550&currency=EUR', 'lat=63.5&lon=25.5&radius_km=550&currency=EUR&date__gte=2026-05-01', 'lat=63.67&lon=22.7&radius_km=60&currency=EUR']) {
  const r = await get('https://prices.openfoodfacts.org/api/v1/prices?size=100&order_by=-date&' + q)
  let j; try { j = JSON.parse(r.t) } catch { console.log(q, r.s, r.t.slice(0, 200)); continue }
  const c = {}; for (const x of j.items ?? []) { const k = (x.location?.osm_address_country_code ?? '?') + ' ' + (x.location?.osm_brand || x.location?.osm_name) + ' ' + (x.location?.osm_address_city ?? ''); c[k] = (c[k] ?? 0) + 1 }
  console.log(q, r.s, 'total', j.total, 'pages', j.pages, JSON.stringify(c).slice(0, 700))
  console.log(' sample', (j.items ?? []).slice(0, 4).map((x) => [x.product_code, x.price, x.date, x.location?.osm_name, x.location?.osm_address_city]))
  await sleep(1500)
}
