// Reads the offers out of the shops' current online leaflets (the PDFs the shops
// publish for download), so the app can list them and show which need a
// membership card (Lidl Plus, club offers…). Every offer links back to its page
// in the leaflet. Leaflets that are only pictures (no text in the PDF) are skipped.
// Needs pdftotext (poppler-utils). Output: public/prices/offers.json
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { offersOf } from './leafletParse.mjs'
import { readPpm, refineCrop } from './cropRefine.mjs'
import { datesFrom } from './leafletDates.mjs'

const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(u, bin) {
  await sleep(1200)
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) })
  if (!r.ok) throw new Error(`${r.status} ${u}`)
  if (!bin) return r.text()
  const len = +r.headers.get('content-length') || 0
  if (len > 120e6) throw new Error('PDF too big')
  return Buffer.from(await r.arrayBuffer())
}
const iso = (d) => d.toISOString().slice(0, 10)
const today = iso(new Date())

function readPdf(buf) {
  writeFileSync('/tmp/leaflet.pdf', buf)
  return execFileSync('pdftotext', ['-bbox-layout', '-l', '40', '/tmp/leaflet.pdf', '-'], { maxBuffer: 200e6 }).toString()
}
/** A small picture of one page (360 px wide) to find the offer boxes on. */
function pagePicture(n) {
  try {
    execFileSync('pdftoppm', ['-f', String(n), '-l', String(n), '-scale-to-x', '360', '-scale-to-y', '-1', '-singlefile', '/tmp/leaflet.pdf', '/tmp/page'])
    return readPpm(readFileSync('/tmp/page.ppm'))
  } catch { return null }
}
/** Each offer's whole box (photo, name and price) instead of the rough area around the price. */
function refineAll(offers) {
  const pics = new Map()
  for (const o of offers) {
    if (!pics.has(o.page)) pics.set(o.page, pagePicture(o.page))
    const img = pics.get(o.page)
    if (img && o.region && o.seed) {
      const box = refineCrop(img, o.region, o.seed)
      if (box[2] * box[3] < 0.5 && box[2] > 0.08 && box[3] > 0.05) o.crop = box
    }
    delete o.region; delete o.seed
  }
}

const leaflets = JSON.parse(readFileSync('public/prices/leaflets.json', 'utf8'))
let previous = {}
try { previous = JSON.parse(readFileSync('public/prices/offers.json', 'utf8')) } catch {}
const out = { updated: new Date().toISOString(), offers: [] }
const done = new Set()

async function add(chain, l, src) {
  try {
    const { pdf, from, until, pageImage } = await src()
    if (until && until < today) return
    const html = readPdf(await get(pdf, true))
    const offers = offersOf(html).filter((o) => o.name.length >= 4)
    refineAll(offers)
    rmSync('/tmp/leaflet.pdf', { force: true })
    console.log(chain, l.name, from, until, offers.length, 'offers')
    for (const o of offers) {
      out.offers.push({ chain, leaflet: l.name, url: l.url, ...o, pageImage: pageImage(o.page), validFrom: from, validUntil: until })
    }
    done.add(l.url)
  } catch (e) { console.log('skip', chain, l.name, String(e).slice(0, 160)) }
}

// Lidl: the flyer API gives the PDF, dates and a picture of every page.
for (const l of leaflets.lidl || []) {
  const slug = l.url.match(/tarjouslehdet\/([^/]+)/)?.[1]
  if (!slug) continue
  await add('lidl', l, async () => {
    const f = JSON.parse(await get(`https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=${slug}&region_id=0&region_code=0`)).flyer
    return { pdf: f.pdfUrl, from: f.offerStartDate || f.startDate, until: f.offerEndDate || f.endDate, pageImage: (n) => f.pages?.[n - 1]?.image ?? f.pages?.[n - 1]?.thumbnail ?? null }
  })
}

// Publitas / Promozilla viewers (Minimani, Rusta, Halpa-Halli): data.json has the PDF.
for (const chain of ['minimani', 'rusta', 'halpahalli']) {
  for (const l of leaflets[chain] || []) {
    const m = l.url.match(/^(https:\/\/view\.(?:publitas|promozilla)\.com)\/[^?#]+?\/?$/)
    if (!m) continue
    const base = l.url.endsWith('/') ? l.url : l.url + '/'
    await add(chain, l, async () => {
      const d = JSON.parse(await get(base + 'data.json'))
      if (!d.config?.downloadPdfUrl) throw new Error('no PDF')
      const spreads = JSON.parse(await get(base + 'spreads.json'))
      const pages = spreads.flatMap((s) => s.pages || [])
      const firstText = pages.slice(0, 2).map((p) => p.text || '').join(' ')
      let [from, until] = datesFrom(firstText)
      if (!until) [from, until] = datesFrom(`${l.name} ${d.slug}`)
      // undated catalogues (toys, yarn…): keep for 5 weeks after publishing
      const published = d.sourceDocumentTitle && Date.parse(d.sourceDocumentTitle)
      if (!until && published) until = iso(new Date(published + 35 * 864e5))
      if (!until) throw new Error('no date')
      return { pdf: d.config.downloadPdfUrl, from, until, pageImage: (n) => (pages[n - 1]?.images?.at1200 ? 'https://view.publitas.com' + pages[n - 1].images.at1200 : null) }
    })
  }
}

// A leaflet that failed this time keeps its offers from the last run while still valid.
for (const o of previous.offers || []) {
  const stillListed = Object.values(leaflets).some((v) => Array.isArray(v) && v.some((l) => l.url === o.url))
  if (!done.has(o.url) && stillListed && (!o.validUntil || o.validUntil >= today)) out.offers.push(o)
}
// Keep only page pictures that can actually be loaded.
const ok = new Map()
for (const u of new Set(out.offers.map((o) => o.pageImage).filter(Boolean))) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
    ok.set(u, r.ok && /^image\//.test(r.headers.get('content-type') || ''))
    await r.arrayBuffer()
  } catch { ok.set(u, false) }
  await sleep(200)
}
let dropped = 0
for (const o of out.offers) if (o.pageImage && !ok.get(o.pageImage)) { o.pageImage = null; dropped++ }
console.log('page pictures', ok.size, 'not loadable', [...ok.values()].filter((v) => !v).length, 'offers without picture', dropped)
out.offers.sort((a, b) => (a.validUntil || '9').localeCompare(b.validUntil || '9') || a.chain.localeCompare(b.chain) || a.page - b.page)
writeFileSync('public/prices/offers.json', JSON.stringify(out) + '\n')
console.log('total', out.offers.length)
