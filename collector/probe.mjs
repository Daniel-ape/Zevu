const q = `[out:json][timeout:25];nwr["shop"~"supermarket|convenience|variety_store|department_store|general"]["brand"~"Lidl|Tokmanni|Prisma|S-market|Sale|Alepa|K-Citymarket|K-Supermarket|K-Market|K-Extra|Eurospar|Spar",i](around:30000,63.675,22.705);out center tags;`
let r
for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Hintaopas/0.1' } })
console.log('STATUS', ep, r.status, r.headers.get('access-control-allow-origin'))
if (r.ok) break }
const d = await r.json()
for (const e of d.elements) console.log('EL', JSON.stringify({ b: e.tags.brand, n: e.tags.name, w: e.tags.website || e.tags['contact:website'], lat: e.lat ?? e.center?.lat }))
