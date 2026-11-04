// Temporary: can leaflet contents (products + prices) be read as data?
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(u) {
  await sleep(1500)
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(30000) })
    const t = await r.text()
    console.log(`-- ${r.status} ${r.headers.get('content-type')} ${t.length}b ${u}`)
    return r.ok ? t : ''
  } catch (e) { console.log('-- ERR', u, String(e)); return '' }
}
const show = (t, n = 1500) => console.log(t.slice(0, n).replace(/\s+/g, ' '))

for (const h of ['https://endpoints.leaflets.schwarz', 'https://view.publitas.com', 'https://view.promozilla.com', 'https://tarjoussanomat.tokmanni.fi', 'https://www.minimani.fi']) {
  show(await get(h + '/robots.txt'), 600)
}

console.log('\n===== LIDL')
const lidl = await get('https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=koko-suomen-tarjoukset-to-5-11-su-8-11&region_id=0&region_code=0')
if (lidl) {
  try {
    const j = JSON.parse(lidl); console.log('keys', Object.keys(j), Object.keys(j.flyer || {}))
    const f = j.flyer || j
    const prods = f.products ? Object.values(f.products) : []
    console.log('products', prods.length); show(JSON.stringify(prods.slice(0, 3)), 3000)
    const pages = f.pages || []; console.log('pages', pages.length); show(JSON.stringify(pages[1] || {}), 1500)
  } catch (e) { show(lidl) }
}

for (const base of ['https://view.publitas.com/minimani-yhtiot-oy/vko45_2026_alkuviikko/', 'https://view.promozilla.com/halpa-halli/halpa-halli-week-45-46/', 'https://view.publitas.com/rusta-kuvasto/dm-2645-fi/']) {
  console.log('\n=====', base)
  const html = await get(base)
  const m = [...new Set(html.match(/[\w/.:-]*\.json[\w?=&-]*/g) || [])].slice(0, 20); console.log('json refs', m)
  console.log('has price-like', (html.match(/\d+,\d{2}\s?€/g) || []).slice(0, 10))
  for (const p of ['data.json', 'spreads.json', 'products.json', 'hotspots.json', 'pages.json']) {
    const t = await get(base + p); if (t) { show(t, 2500) }
  }
}

console.log('\n===== TOKMANNI iPaper')
for (const base of ['https://tarjoussanomat.tokmanni.fi/Ruokasanomat/']) {
  const html = await get(base)
  const keys = [...new Set(html.match(/"(?:[A-Za-z]*(?:Enrichment|Hotspot|Product|Link|Text|Search|PaperId|PaperGuid)[A-Za-z]*)"\s*:\s*[^,]{0,80}/g) || [])].slice(0, 30)
  console.log(keys)
  const apis = [...new Set(html.match(/https?:\/\/[\w.-]*ipaper[\w./?=&-]*/g) || [])].slice(0, 20); console.log(apis)
  console.log('price-like', (html.match(/\d+,\d{2}/g) || []).slice(0, 10))
  for (const p of ['Search?query=maito', 'api/Search?query=maito', 'Enrichments', 'GetPaperSettings']) await get(base + p)
}
