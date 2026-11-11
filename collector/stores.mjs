// Price collector for web shops whose product pages publish the barcode (GTIN)
// and price in schema.org JSON-LD. Usage: node collector/stores.mjs <store>
//
// Rules we keep: robots.txt is honoured (only the "*" group or our own name),
// requests are spaced out (the shop's Crawl-delay or our own minimum), we
// identify ourselves, and each run stops after a time budget. The shop's
// product list comes from its public sitemap; a state file remembers what was
// read, so the whole range is gone through over several days, newest-unread
// first and then the oldest checked.
//
// Output: public/prices/<store>.json — barcode, price, name, picture, link.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { foodRank } from './foodGuess.mjs'

/** EAN-8/13 with a correct check digit. */
const validEan = (g) => {
  if (!/^(\d{8}|\d{13})$/.test(g)) return false
  const d = [...g].map(Number), last = d.pop()
  const sum = d.reverse().reduce((n, x, i) => n + x * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === last
}

const STORES = {
  halpahalli: { retailerId: 'halpahalli', base: 'https://www.halpahalli.fi', sitemaps: ['https://www.halpahalli.fi/media/sitemap/sitemap_product.xml', 'https://www.halpahalli.fi/media/sitemap/sitemap_product_002.xml'], product: /\.html$/, keep: 'all', foodFirst: true,
    // Most of Halpa-Halli's food can't be ordered online ("out of stock" in the
    // web shop) but is sold in the shops at the price shown: keep it, marked.
    storeOnlyFood: true },
  verkkokauppa: { retailerId: 'verkkokauppa', base: 'https://www.verkkokauppa.com', sitemaps: ['https://www.verkkokauppa.com/gsitemaps1/sitemap.xml'], product: /\/fi\/product\/\d+/, keep: 'all' },
  prisma: { retailerId: 'prisma', base: 'https://www.prisma.fi', sitemaps: ['https://www.prisma.fi/sitemap.xml'], product: /\/tuotteet\/\d+\//, keep: 'all' },
  karkkainen: { retailerId: 'karkkainen', base: 'https://www.karkkainen.com', sitemaps: ['https://www.karkkainen.com/files/sitemap/sitemap.xml'], maps: /products_/, product: /karkkainen\.com\/verkkokauppa\//, keep: 'all' },
  lidl: { retailerId: 'lidl', base: 'https://www.lidl.fi', sitemaps: ['https://www.lidl.fi/static/sitemap.xml'], maps: /product/, product: /\/p\/[^/]+\/p\d+/, keep: 'all' },
  apteekki360: { retailerId: 'apteekki360', base: 'https://apteekki360.fi', sitemaps: ['https://apteekki360.fi/sitemap.xml'], maps: /sitemap_products/, product: /\/products\//, keep: 'all' },
  ruohonjuuri: { retailerId: 'ruohonjuuri', base: 'https://www.ruohonjuuri.fi', sitemaps: ['https://www.ruohonjuuri.fi/sitemap.xml'], maps: /sitemap_products/, product: /\/products\//, keep: 'all' },
  yliopistonapteekki: { retailerId: 'yliopistonapteekki', base: 'https://www.yliopistonapteekki.fi', sitemaps: ['https://www.yliopistonapteekki.fi/pub/media/sitemap.xml'], product: /-\d{3,}$/, keep: 'all' },
  // Minimani's web shop has its whole range, groceries included (meat, dairy, frozen…).
  minimani: { retailerId: 'minimani', base: 'https://www.minimani.fi', sitemaps: ['https://www.minimani.fi/sitemap/sitemap.xml'], product: /^https:\/\/www\.minimani\.fi\/[^/]+\.html$/, keep: 'all', foodFirst: true, skuIsEan: true },
  // Jimm's has no sitemap: its products are found through the category pages (see `lists`).
  jimms: { retailerId: 'jimms', base: 'https://www.jimms.fi', sitemaps: [], lists: { start: 'https://www.jimms.fi/', link: /\/fi\/Product\/List\/[0-9A-Z]{3}-[0-9A-Z]{3}\/[a-z0-9-]+/g, show: /\/fi\/Product\/Show\/(\d+)/g, share: 0.3, maxPages: 80 }, product: /^https:\/\/www\.jimms\.fi\/fi\/Product\/Show\/\d+$/, keep: 'all' },
  multitronic: { retailerId: 'multitronic', base: 'https://www.multitronic.fi', sitemaps: ['https://www.multitronic.fi/sitemap.xml'], maps: /sitemap\/fi\/sitemap_product/, product: /\/fi\/products\/\d+$/, keep: 'all' },
  power: { retailerId: 'power', base: 'https://www.power.fi', sitemaps: ['https://www.power.fi/services/sitemap.xml'], maps: /products-\d+\.xml/, product: /\/p-\d+\/?$/, keep: 'all' },
  stockmann: { retailerId: 'stockmann', base: 'https://www.stockmann.com', sitemaps: ['https://www.stockmann.com/sitemap.xml'], product: /\/\d{6,}\.html$/, keep: 'all' },
}
const name = process.argv[2]
const cfg = STORES[name]
if (!cfg) throw new Error(`unknown store ${name}`)

const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const BUDGET = Number(process.env.BUDGET_MIN ?? 270) * 60_000
const START = Date.now()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const over = () => Date.now() - START > BUDGET
// Pages are read with a timeout and a size cap, so one endless or huge
// response can't stall the run or use up the memory.
const MAX_BYTES = 8 * 1024 * 1024
async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45_000) })
  if (r.status === 429 || r.status === 403) throw Object.assign(new Error(`${r.status} ${url}`), { stop: true })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  const chunks = []
  let size = 0
  for await (const c of r.body) {
    size += c.length
    if (size > (/\.xml/i.test(url) ? 10 * MAX_BYTES : MAX_BYTES)) { r.body.cancel?.().catch(() => {}); throw new Error(`too large ${url}`) }
    chunks.push(c)
  }
  const buf = Buffer.concat(chunks)
  return url.endsWith('.gz') ? gunzipSync(buf).toString() : buf.toString()
}

// robots.txt: rules of the "*" group (or ours), and its Crawl-delay
const robots = await get(cfg.base + '/robots.txt').catch(() => '')
const groups = []
let cur = null
for (const raw of robots.split('\n')) {
  const line = raw.replace(/#.*/, '').trim()
  const [k, ...rest] = line.split(':')
  const v = rest.join(':').trim()
  if (/^user-agent$/i.test(k)) { if (!cur || cur.rules.length || cur.delay) groups.push((cur = { agents: [], rules: [], delay: 0 })); cur.agents.push(v.toLowerCase()) }
  else if (cur && /^disallow$/i.test(k) && v) cur.rules.push(v)
  else if (cur && /^crawl-delay$/i.test(k)) cur.delay = Number(v) || 0
}
const mine = groups.filter((g) => g.agents.includes('hintaopasbot'))
const apply = mine.length ? mine : groups.filter((g) => g.agents.includes('*'))
const rules = apply.flatMap((g) => g.rules)
const DELAY = Math.max(3000, ...apply.map((g) => g.delay * 1000))
const blocked = (path) => rules.some((r) => new RegExp('^' + r.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')).test(path))
console.log(`${name}: ${rules.length} robots rules, ${DELAY / 1000} s between requests`)

// Product links from the sitemaps (sitemap indexes are followed)
const urls = new Set()
const queue = [...(cfg.sitemaps ?? [])]
const seenMaps = new Set()
while (queue.length && !over()) {
  const map = queue.shift()
  if (seenMaps.has(map) || seenMaps.size > 400) continue
  seenMaps.add(map)
  try {
    const xml = await get(map)
    for (const [, loc] of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const u = loc.replace(/&amp;/g, '&')
      if (/\.xml(\.gz)?([?#].*)?$/i.test(u)) { if (!cfg.maps || cfg.maps.test(u)) queue.push(u) }
      else if (cfg.product.test(u) && u.startsWith(cfg.base) && !blocked(new URL(u).pathname)) urls.add(u)
    }
  } catch (e) {
    if (e.stop) { console.log('stopped by the shop:', e.message); break }
    console.log('sitemap', e.message)
  }
  await sleep(1000)
}
// Shops without a sitemap (Jimm's): product pages are found by going through
// the category pages, page by page. Only the deepest categories are read (a
// parent lists its children's products again), the ones read longest ago first,
// for a share of the time budget. Products not seen for 30 days are dropped.
if (cfg.lists) {
  mkdirSync('collector/state', { recursive: true })
  const LS = `collector/state/${name}-lists.json`
  const ls = existsSync(LS) ? JSON.parse(readFileSync(LS, 'utf8')) : { lists: {}, products: {} }
  const home = await get(cfg.lists.start).catch((e) => { console.log('start page', e.message); return '' })
  const found = [...new Set([...home.matchAll(cfg.lists.link)].map((m) => cfg.base + m[0]))].filter((u) => !blocked(new URL(u).pathname))
  const slugs = found.map((u) => u.split('/').pop())
  const leaves = found.filter((u) => { const sl = u.split('/').pop(); return !slugs.some((o) => o !== sl && o.startsWith(sl + '--')) })
  if (leaves.length) {
    for (const u of leaves) ls.lists[u] ??= ''
    for (const u of Object.keys(ls.lists)) if (!leaves.includes(u)) delete ls.lists[u]
  }
  const stopAt = START + BUDGET * cfg.lists.share
  let pages = 0
  outer: for (const lu of Object.keys(ls.lists).sort((a, b) => ls.lists[a].localeCompare(ls.lists[b]))) {
    if (Date.now() > stopAt) break
    const seen = new Set()
    for (let pg = 1; pg <= cfg.lists.maxPages; pg++) {
      await sleep(DELAY)
      let html
      try { html = await get(pg === 1 ? lu : `${lu}?p=${pg}`); pages++ } catch (e) {
        if (e.stop) { console.log('stopped by the shop:', e.message); break outer }
        break
      }
      const fresh = [...new Set([...html.matchAll(cfg.lists.show)].map((m) => m[1]))].filter((id) => !seen.has(id))
      const now = new Date().toISOString()
      for (const id of fresh) { seen.add(id); ls.products[`${cfg.base}/fi/Product/Show/${id}`] = now }
      if (fresh.length < 5) break // past the last page (or only the menu's products left)
    }
    ls.lists[lu] = new Date().toISOString()
  }
  const old = new Date(Date.now() - 30 * 86_400_000).toISOString()
  for (const [u, at] of Object.entries(ls.products)) { if (at < old) delete ls.products[u]; else if (cfg.product.test(u)) urls.add(u) }
  writeFileSync(LS, JSON.stringify(ls))
  console.log(`${found.length} categories (${leaves.length} deepest), ${pages} list pages read, ${urls.size} product pages known`)
}
// Shops with the same page in several languages: keep the Finnish one.
if (cfg.prefer && [...urls].some((u) => cfg.prefer.test(u))) for (const u of [...urls]) if (!cfg.prefer.test(u)) urls.delete(u)
if (!cfg.lists) console.log(`${urls.size} product pages in the sitemaps`)

// State: what each page held when last read
mkdirSync('collector/state', { recursive: true })
const STATE = `collector/state/${name}.json`
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {}
// Never read first, then the ones read longest ago. Shops that also sell
// food read it first and count food as older, so it is checked more often.
const DAY = 86_400_000
const keyOf = (u) => {
  const rank = cfg.foodFirst ? foodRank(u) : 0
  const at = state[u]?.at
  if (!at) return `0 ${rank}`
  return `1 ${new Date(Date.parse(at) - (cfg.foodFirst ? [7, 3, 0][rank] * DAY : 0)).toISOString()}`
}
const keys = new Map([...urls].map((u) => [u, keyOf(u)]))
const order = [...urls].sort((a, b) => keys.get(a).localeCompare(keys.get(b)))

// Text cut out of a page can keep the whole page in memory (V8 "sliced
// strings"); after thousands of pages that runs out of memory. Copy it.
const own = (v) => (v == null ? v : Buffer.from(String(v)).toString())

function productFrom(html) {
  for (const [, j] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let d
    try { d = JSON.parse(j) } catch { continue }
    for (const x of [].concat(d['@graph'] ?? d)) {
      if (!x || !/Product/.test([].concat(x['@type']).join(' '))) continue
      // Some shops leave the barcode out of JSON-LD but print it elsewhere on the page.
      const gtin = [].concat(x.gtin13 ?? x.gtin ?? x.gtin8 ?? x.gtin12 ?? x.ean ?? []).map(String).find((g) => /^\d{8,14}$/.test(g))
        ?? html.match(/["'](?:ean|ean13|gtin|gtin13|barcode)["']\s*[:=]\s*["']?(\d{8,14})/i)?.[1]
        // Some shops (Minimani) put the barcode in sku; only a real EAN (valid check digit) counts.
        ?? (cfg.skuIsEan && validEan(String(x.sku ?? '')) ? String(x.sku) : undefined)
      const offer = [].concat(x.offers ?? [])[0]
      const price = parseFloat(offer?.price ?? offer?.lowPrice)
      if (!gtin || !(price > 0)) continue
      const img = [].concat(x.image ?? [])[0]
      return {
        ean: own(gtin.length === 14 && gtin.startsWith('0') ? gtin.slice(1) : gtin.length === 12 ? '0' + gtin : gtin),
        priceCents: Math.round(price * 100),
        name: own(String(x.name ?? '').replace(/&amp;/g, '&').trim().slice(0, 120)),
        brand: own(String((typeof x.brand === 'object' ? x.brand?.name : x.brand) ?? '').slice(0, 60)),
        image: own(typeof img === 'string' ? img : img?.url),
        inStock: !/OutOfStock/i.test(String(offer?.availability ?? '')),
      }
    }
  }
  return microdataFrom(html)
}

// schema.org microdata (itemprop attributes) for shops without JSON-LD (Jimm's)
const decode = (t) => t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
function microdataFrom(html) {
  const price = parseFloat(html.match(/itemprop="price"[^>]*?content="([\d.]+)"/)?.[1])
  const gtin = html.match(/itemprop="gtin13"[^>]*?content="(\d{8,14})"/)?.[1] ?? html.match(/itemprop="gtin13"[^>]*>\s*(\d{8,14})\s*</)?.[1]
  if (!gtin || !(price > 0)) return null
  const ean = gtin.length === 14 && gtin.startsWith('0') ? gtin.slice(1) : gtin.length === 12 ? '0' + gtin : gtin
  if (!validEan(ean)) return null
  const title = html.match(/property="og:title"\s+content="([^"]+)"/)?.[1] ?? html.match(/<title>([^<]+)/)?.[1] ?? ''
  const brand = html.match(/itemprop="brand"[\s\S]{0,400}?itemprop="name"(?:\s+content="([^"]*)")?[^>]*>([^<]*)/)
  const img = html.match(/itemprop="image"[^>]*?(?:src|content|href)="([^"]+)"/)?.[1]
  return {
    ean: own(ean),
    priceCents: Math.round(price * 100),
    name: own(decode(title.replace(/\s+-\s+[\d\s.,]+\s*(€|&euro;)\s*$/, '')).trim().slice(0, 120)),
    brand: own(decode(String(brand?.[1] || brand?.[2] || '')).trim().slice(0, 60)),
    image: own(img ? (img.startsWith('//') ? 'https:' + img : img) : undefined),
    inStock: !/itemprop="availability"[^>]*schema\.org\/(OutOfStock|Discontinued|SoldOut)/i.test(html),
  }
}

let read = 0
for (const url of order) {
  if (over()) { console.log('time budget reached'); break }
  await sleep(DELAY)
  try {
    const p = productFrom(await get(url))
    state[url] = p ? { ...p, at: new Date().toISOString() } : { at: new Date().toISOString() }
    read++
  } catch (e) {
    if (e.stop) { console.log('stopped by the shop:', e.message); break }
    state[url] = { ...(state[url] ?? {}), at: new Date().toISOString() }
  }
  if (read % 200 === 0) {
    writeFileSync(STATE, JSON.stringify(state))
    if (read) console.log(`${read} pages, heap ${Math.round(process.memoryUsage().heapUsed / 1e6)} MB`)
  }
}
// forget pages no longer in the sitemap
for (const u of Object.keys(state)) if (!urls.has(u) && urls.size) delete state[u]
writeFileSync(STATE, JSON.stringify(state))
console.log(`read ${read} pages this run, ${Object.values(state).filter((s) => s.ean).length} products known`)

// Prices from the last 14 days. Big shops keep only products the app can
// compare (in the catalogue or sold by another collected store).
const known = new Set(JSON.parse(readFileSync('public/products/fi.json', 'utf8')).rows.map((r) => r[0]))
for (const f of ['tokmanni', 'halpahalli']) {
  const p = `public/prices/${f}.json`
  if (f !== name && existsSync(p)) for (const x of JSON.parse(readFileSync(p, 'utf8')).prices) known.add(x.ean)
}
const since = new Date(Date.now() - 14 * 86_400_000).toISOString()
const byEan = new Map()
for (const [url, s] of Object.entries(state)) {
  // out of stock online: kept only for shops whose food is sold in the shops instead
  const storeOnly = !s.inStock && cfg.storeOnlyFood && foodRank(url) < 2
  if (!s.ean || s.at < since || (!s.inStock && !storeOnly)) continue
  if (cfg.keep === 'match' && !known.has(s.ean)) continue
  const prev = byEan.get(s.ean)
  // an orderable page beats a shop-only one; otherwise the lower price wins
  const better = !prev || (prev.store && !storeOnly) || (!!prev.store === storeOnly && s.priceCents < prev.priceCents)
  if (better) byEan.set(s.ean, { ean: s.ean, priceCents: s.priceCents, name: s.name, brand: s.brand, image: s.image, url, checkedAt: s.at, ...(storeOnly ? { store: true } : {}) })
}
const prices = [...byEan.values()]
mkdirSync('public/prices', { recursive: true })
// One product per line, so daily changes stay small in git.
const head = JSON.stringify({ source: `${cfg.base} product pages`, retailerId: cfg.retailerId, fetchedAt: new Date().toISOString() }).slice(0, -1)
writeFileSync(`public/prices/${name}.json`, `${head},"prices":[\n${prices.sort((a, b) => a.ean.localeCompare(b.ean)).map((p) => JSON.stringify(p)).join(',\n')}\n]}\n`)
console.log(`saved ${prices.length} prices`)

// Price history (one point per change, 180 days)
const HISTORY = `public/prices/${name}-history.json`
const history = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, 'utf8')) : {}
const today = new Date().toISOString().slice(0, 10)
const cutoff = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10)
for (const { ean, priceCents } of prices) {
  const points = (history[ean] ?? []).filter(([d]) => d >= cutoff && d !== today)
  const last = points[points.length - 1]
  if (!last || last[1] !== priceCents) points.push([today, priceCents])
  history[ean] = points
}
for (const e of Object.keys(history)) if (!byEan.has(e)) delete history[e]
writeFileSync(HISTORY, `{\n${Object.keys(history).sort().map((e) => `${JSON.stringify(e)}:${JSON.stringify(history[e])}`).join(',\n')}\n}\n`)
