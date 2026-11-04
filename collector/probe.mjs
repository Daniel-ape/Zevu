// Temporary: can leaflet contents (products + prices) be read as data? Round 2.
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(u, bin) {
  await sleep(1500)
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })
    console.log(`-- ${r.status} ${r.headers.get('content-type')} ${u.slice(0, 140)}`)
    if (!r.ok) return null
    return bin ? Buffer.from(await r.arrayBuffer()) : r.text()
  } catch (e) { console.log('-- ERR', u, String(e)); return null }
}

console.log('===== LIDL flyer keys')
const l = JSON.parse(await get('https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=koko-suomen-tarjoukset-to-5-11-su-8-11&region_id=0&region_code=0'))
const f = l.flyer
for (const [k, v] of Object.entries(f)) console.log(k, JSON.stringify(v).slice(0, 200))

async function pdfText(url, name) {
  const b = await get(url, true); if (!b) return
  writeFileSync(`/tmp/${name}.pdf`, b)
  const t = execSync(`pdftotext -layout -f 2 -l 3 /tmp/${name}.pdf -`).toString()
  console.log(`\n### ${name} pdf ${b.length}b text:\n` + t.slice(0, 4000))
}

for (const base of ['https://view.promozilla.com/halpa-halli/halpa-halli-week-45-46/', 'https://view.publitas.com/rusta-kuvasto/dm-2645-fi/']) {
  console.log('\n=====', base)
  const d = JSON.parse(await get(base + 'data.json'))
  console.log('data keys', Object.keys(d))
  const s = JSON.parse(await get(base + 'spreads.json'))
  const p = s.flatMap((x) => x.pages || [])
  console.log('page keys', Object.keys(p[1] || {}), 'spread keys', Object.keys(s[1] || {}))
  const hs = s.flatMap((x) => x.hotspots || []).concat(p.flatMap((x) => x.hotspots || []))
  console.log('hotspots', hs.length); console.log(JSON.stringify(hs.slice(0, 4)).slice(0, 3000))
  if (d.config?.downloadPdfUrl) await pdfText(d.config.downloadPdfUrl, d.slug)
}

console.log('\n===== MINIMANI current')
const mm = await get('https://www.minimani.fi/lehti-ilmoitukset-mainoslehti')
console.log([...new Set((mm || '').match(/https?:\/\/view\.publitas\.com\/[^"' <]+/g) || [])].slice(0, 10))
const m1 = [...new Set((mm || '').match(/https?:\/\/view\.publitas\.com\/minimani-yhtiot-oy\/[^"' <?#]+/g) || [])][0]
if (m1) {
  const base = m1.endsWith('/') ? m1 : m1 + '/'
  const d = JSON.parse(await get(base + 'data.json') || '{}')
  if (d.config?.downloadPdfUrl) await pdfText(d.config.downloadPdfUrl, 'minimani')
}

console.log('\n===== TOKMANNI pdf?')
const tk = await get('https://tarjoussanomat.tokmanni.fi/Ruokasanomat/')
console.log((tk || '').match(/[^"' ]*(?:pdf|PDF)[^"' ]*/g)?.slice(0, 10))
console.log((tk || '').match(/"PaperId"\s*:\s*\d+|"paperId"\s*:\s*\d+|PaperGuid[^,]{0,60}/g)?.slice(0, 5))
