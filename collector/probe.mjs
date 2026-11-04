// Temporary: save leaflet PDF text with word positions so a parser can be built offline.
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(u, bin) {
  await sleep(1500)
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(90000) })
  console.log(`-- ${r.status} ${u.slice(0, 120)}`)
  if (!r.ok) return null
  return bin ? Buffer.from(await r.arrayBuffer()) : r.text()
}
mkdirSync('out', { recursive: true })
async function pdf(url, name) {
  const b = await get(url, true); if (!b) return
  writeFileSync(`/tmp/${name}.pdf`, b)
  execSync(`pdftotext -bbox-layout -l 12 /tmp/${name}.pdf out/${name}.html`)
  execSync(`pdftotext -layout -l 12 /tmp/${name}.pdf out/${name}.txt`)
  execSync(`pdftoppm -r 40 -jpeg -f 2 -l 3 /tmp/${name}.pdf out/${name}`)
}
const lidl = JSON.parse(await get('https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=koko-suomen-tarjoukset-to-5-11-su-8-11&region_id=0&region_code=0')).flyer
writeFileSync('out/lidl-flyer.json', JSON.stringify(lidl.pages.map((p) => ({ n: p.number, k: p.keyWords, a: p.altText }))))
await pdf(lidl.pdfUrl, 'lidl')
for (const [name, base] of [['rusta', 'https://view.publitas.com/rusta-kuvasto/dm-2645-fi/'], ['minimani', 'https://view.publitas.com/minimani-yhtiot-oy/minimani_tarjouslehti_vko38_2026_hp/']]) {
  const d = JSON.parse(await get(base + 'data.json'))
  const s = JSON.parse(await get(base + 'spreads.json'))
  writeFileSync(`out/${name}-spreads-text.json`, JSON.stringify(s.flatMap((x) => x.pages).map((p) => ({ n: p.number, text: p.text }))))
  await pdf(d.config.downloadPdfUrl, name)
}
