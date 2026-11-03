const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
for (const [u, needle] of [['https://www.halpahalli.fi/mainokset', /publitas/gi], ['https://www.minimani.fi/lehti-ilmoitukset-mainoslehti', /publitas/gi], ['https://www.rusta.com/fi-fi/kuvasto', /iframe|ipaper|publitas|issuu|flipp|\.pdf|catalog/gi]]) {
  const h = await (await fetch(u, { headers: { 'User-Agent': UA } })).text()
  const hits = [...h.matchAll(needle)].slice(0, 8)
  console.log('PAGE', u, hits.length)
  for (const m of hits) console.log('CTX', JSON.stringify(h.slice(Math.max(0, m.index - 200), m.index + 250)))
  await new Promise((r) => setTimeout(r, 1500))
}
for (const u of ['https://view.publitas.com/minimani-yhtiot-oy/', 'https://view.publitas.com/minimani-yhtiot-oy/publications.json', 'https://view.publitas.com/kokkolan-halpa-halli-oy/']) {
  const r = await fetch(u, { headers: { 'User-Agent': UA } }); const h = await r.text()
  console.log('PUB', u, r.status, r.url, h.slice(0, 300).replace(/\s+/g, ' '))
}
