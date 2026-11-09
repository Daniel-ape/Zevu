// Reads the offers out of the shops' current online leaflets (the PDFs the shops
// publish for download), so the app can list them and show which need a
// membership card (Lidl Plus, club offers…). Every offer links back to its page
// in the leaflet. Leaflets that are only pictures (no text in the PDF) are skipped.
// Needs pdftotext (poppler-utils). Output: public/prices/offers.json
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
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
/**
 * The product photos placed on each page: pdftohtml lists every embedded picture with
 * its position. Page-sized backgrounds and tiny icons (logos, badges) are left out.
 * → Map(page number → [[left, top, width, height] as parts of the page])
 */
function photosOf() {
  const out = new Map()
  try {
    rmSync('/tmp/ph', { recursive: true, force: true }); mkdirSync('/tmp/ph')
    execFileSync('pdftohtml', ['-xml', '-q', '-l', '40', '/tmp/leaflet.pdf', '/tmp/ph/out'], { maxBuffer: 200e6, timeout: 180000 })
    const xml = readFileSync('/tmp/ph/out.xml', 'utf8')
    for (const pm of xml.matchAll(/<page number="(\d+)"[^>]*height="([\d.]+)" width="([\d.]+)">([\s\S]*?)<\/page>/g)) {
      const H = +pm[2], W = +pm[3], list = []
      for (const im of pm[4].matchAll(/<image top="(-?[\d.]+)" left="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
        let [t, l, w, h] = [+im[1] / H, +im[2] / W, +im[3] / W, +im[4] / H]
        // clip to the page
        const x0 = Math.max(0, l), y0 = Math.max(0, t), x1 = Math.min(1, l + w), y1 = Math.min(1, t + h)
        ;[l, t, w, h] = [x0, y0, x1 - x0, y1 - y0]
        if (w <= 0 || h <= 0) continue
        const area = w * h
        if (area > 0.3 || area < 0.004 || w > 0.9 || h > 0.9) continue
        list.push([l, t, w, h])
      }
      out.set(+pm[1], list)
    }
  } catch (e) { console.log('no photo positions', String(e).slice(0, 120)) }
  rmSync('/tmp/ph', { recursive: true, force: true })
  return out
}

/** Distance between two boxes (0 when they touch or overlap). */
const gap = (a, b) => Math.hypot(Math.max(0, a[0] - (b[0] + b[2]), b[0] - (a[0] + a[2])), Math.max(0, a[1] - (b[1] + b[3]), b[1] - (a[1] + a[3])))
const union = (a, b) => { const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]); return [x0, y0, Math.max(a[0] + a[2], b[0] + b[2]) - x0, Math.max(a[1] + a[3], b[1] + b[3]) - y0] }
const centre = (b) => [b[0] + b[2] / 2, b[1] + b[3] / 2]

/**
 * Each offer gets the product photo that belongs to it: a photo belongs to the offer
 * whose price-and-name area is nearest to it, and of an offer's photos the biggest
 * one close by is used. The cut-out is then photo + name + price together, which
 * is far more exact than guessing the box from the page picture.
 * Returns the offers that got a photo.
 */
function matchPhotos(offers, photos) {
  const got = new Set()
  const byPage = new Map()
  for (const o of offers) if (o.seed) { if (!byPage.has(o.page)) byPage.set(o.page, []); byPage.get(o.page).push(o) }
  for (const [page, list] of byPage) {
    const ps = photos.get(page) || []
    const mine = new Map(list.map((o) => [o, []]))
    for (const ph of ps) {
      let best = null, bd = Infinity, second = Infinity
      for (const o of list) {
        const d = gap(ph, o.seed)
        if (d < bd) { second = bd; bd = d; best = o } else if (d < second) second = d
      }
      // close to its offer, and clearly closer to it than to any other
      if (best && bd < 0.12 && (bd < second * 0.6 || bd === 0 && second > 0.02)) mine.get(best).push(ph)
    }
    for (const [o, phs] of mine) {
      if (!phs.length) continue
      // a photo may sit right on top of another offer's price: then it is not ours
      const others = list.filter((x) => x !== o)
      const clean = phs.filter((ph) => !others.some((x) => { const c = centre(x.seed); return c[0] > ph[0] && c[0] < ph[0] + ph[2] && c[1] > ph[1] && c[1] < ph[1] + ph[3] }))
      if (!clean.length) continue
      const photo = clean.sort((a, b) => b[2] * b[3] - a[2] * a[3])[0]
      let box = union(photo, o.seed)
      // more photos of the same product right next to the main one (a pack and a serving)
      for (const ph of clean) if (ph !== photo && gap(ph, photo) < 0.02) box = union(box, ph)
      const pad = 0.01
      box = [Math.max(0, box[0] - pad), Math.max(0, box[1] - pad), 0, 0, box]
      const b = box[4]
      const x1 = Math.min(1, b[0] + b[2] + pad), y1 = Math.min(1, b[1] + b[3] + pad)
      const r = (v) => Math.round(v * 1000) / 1000
      const final = [r(box[0]), r(box[1]), r(x1 - box[0]), r(y1 - box[1])]
      // the cut-out must not swallow another offer's price
      if (others.some((x) => { const c = centre(x.seed); return c[0] > final[0] && c[0] < final[0] + final[2] && c[1] > final[1] && c[1] < final[1] + final[3] })) continue
      if (final[2] * final[3] > 0.4 || final[2] < 0.08 || final[3] < 0.05) continue
      o.crop = [...final, o.crop?.[4] ?? o.region?.[4] ?? null]
      got.add(o)
    }
  }
  return got
}

/** Each offer's whole box (photo, name and price) instead of the rough area around the price. */
function refineAll(offers, skip = new Set()) {
  const pics = new Map()
  for (const o of offers) {
    if (skip.has(o)) { delete o.region; delete o.seed; continue }
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
    const withPhoto = matchPhotos(offers, photosOf())
    refineAll(offers, withPhoto)
    console.log('  cut-outs from photo positions:', withPhoto.size, 'of', offers.length)
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
