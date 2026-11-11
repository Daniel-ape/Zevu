// Daily Tokmanni price collector (runs in GitHub Actions).
// Tokmanni's robots.txt allows product pages with a 10 s crawl delay; we
// follow that, identify ourselves, and only fetch products the app knows
// (matched by the barcode at the end of Tokmanni's product URLs).
// Output: public/prices/tokmanni.json, served with the web app.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { foodRank } from './foodGuess.mjs'

const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/zevu; grocery price comparison)'
const DELAY = 10_000 // Crawl-delay: 10
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.text()
}

// Respect robots.txt: skip anything it disallows.
// A missing robots.txt (404) means no rules; anything else that fails stops the run.
async function robotsTxt(url) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null)
    if (r?.ok) return r.text()
    if (r?.status === 404 && i === 2) return ''
    await sleep(30_000)
  }
  throw new Error('robots.txt unavailable')
}
const robots = await robotsTxt('https://www.tokmanni.fi/robots.txt')
// Only rules in groups that apply to us: "User-agent: *" or our own name.
function rulesFor(text, agent) {
  const groups = []
  let current = null
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim()
    const [key, ...rest] = line.split(':')
    const value = rest.join(':').trim()
    if (/^user-agent$/i.test(key)) {
      if (!current || current.rules.length) groups.push((current = { agents: [], rules: [] }))
      current.agents.push(value.toLowerCase())
    } else if (/^disallow$/i.test(key) && current && value) current.rules.push(value)
  }
  const mine = groups.filter((g) => g.agents.includes(agent))
  return (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules)
}
const disallow = rulesFor(robots, 'hintaopasbot')
const blockedBy = (rule, path) =>
  new RegExp('^' + rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')).test(path)
const allowed = (path) => !disallow.some((rule) => blockedBy(rule, path))

const known = new Set(JSON.parse(readFileSync('public/products/fi.json', 'utf8')).rows.map((r) => r[0]))
const urls = new Map()
const stats = { withEan: 0, known: 0, blockedExample: '' }
const index = await get('https://www.tokmanni.fi/sitemap/sitemap.xml')
for (const sm of [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])) {
  await sleep(DELAY)
  for (const [, u] of (await get(sm)).matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const m = u.match(/-(\d{8}|\d{13})$/)
    if (!m) continue
    stats.withEan++
    // Every product with a barcode; the ones in the app's catalogue are read first.
    if (known.has(m[1])) stats.known++
    const path = new URL(u).pathname
    if (allowed(path)) urls.set(m[1], u)
    else if (!stats.blockedExample) stats.blockedExample = `${path} by ${disallow.find((r) => !allowed.call(null, path) && blockedBy(r, path))}`
  }
}
console.log('sitemap stats', JSON.stringify(stats), 'known in app', known.size, 'rules', disallow.length)
console.log(`${urls.size} Tokmanni products with a barcode (${stats.known} in the app's catalogue)`)

// Price, plus the product picture Tokmanni shows (used when the catalogue has none).
function productFrom(html) {
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(json)
      const offer = Array.isArray(d.offers) ? d.offers[0] : d.offers
      if (d['@type'] === 'Product' && offer?.price) {
        const img = [].concat(d.image ?? [])[0]
        const image = typeof img === 'string' ? img : img?.url
        const brand = typeof d.brand === 'object' ? d.brand?.name : d.brand
        return {
          cents: Math.round(parseFloat(offer.price) * 100), image: image?.startsWith('https://') ? image : undefined,
          name: String(d.name ?? '').replace(/&amp;/g, '&').trim().slice(0, 120) || undefined, brand: brand ? String(brand).slice(0, 60) : undefined,
        }
      }
    } catch {
      /* not JSON we understand */
    }
  }
  // Food pages have no Product JSON-LD: the price is in the page, the name in its title.
  const m = html.match(/data-price-amount="([\d.]+)"/)
  if (!m) return null
  const text = (t) => t?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
  const name = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]) || text(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1])?.replace(/\s*[|–-]\s*Tokmanni.*$/i, '')
  const image = html.match(/<meta property="og:image" content="(https:\/\/[^"]+)"/)?.[1]
  return { cents: Math.round(parseFloat(m[1]) * 100), name: name ? name.slice(0, 120) : undefined, image }
}

// Each run has a time budget (GitHub stops jobs after 6 h). Products never
// fetched go first, then the ones checked longest ago; prices not re-checked
// this run are kept for up to 10 days.
const START = Date.now()
const BUDGET = 270 * 60_000
const FILE = 'public/prices/tokmanni.json'
const previous = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { prices: [] }
const prev = new Map(previous.prices.map((p) => [p.ean, { ...p, checkedAt: p.checkedAt ?? previous.fetchedAt }]))
// Order: never read (or read without a name) first, catalogue products and
// food before the rest; then the ones read longest ago, where food counts as
// older so its prices are checked more often than the rest of the range.
const DAY = 86_400_000
const rankOf = new Map([...urls].map(([ean, url]) => [ean, known.has(ean) ? -1 : foodRank(url)]))
const keyOf = (ean) => {
  const p = prev.get(ean)
  const rank = rankOf.get(ean)
  if (!p?.checkedAt || !p.name) return `0 ${rank + 1}`
  const bonus = rank <= 0 ? 10 * DAY : rank === 1 ? 4 * DAY : 0
  return `1 ${new Date(Date.parse(p.checkedAt) - bonus).toISOString()}`
}
const keys = new Map([...urls.keys()].map((e) => [e, keyOf(e)]))
const order = [...urls.entries()].sort(([a], [b]) => (keys.get(a) < keys.get(b) ? -1 : keys.get(a) > keys.get(b) ? 1 : 0))
console.log(`food-looking products: ${[...rankOf.values()].filter((r) => r <= 0).length} sure, ${[...rankOf.values()].filter((r) => r === 1).length} maybe`)
const fresh = new Map()
for (const [ean, url] of order) {
  if (Date.now() - START > BUDGET) { console.log('time budget reached'); break }
  await sleep(DELAY)
  try {
    const got = productFrom(await get(url))
    const cents = got?.cents
    if (cents && cents > 0 && cents < 100000) fresh.set(ean, { ean, priceCents: cents, name: got.name, brand: got.brand, url, image: got.image, checkedAt: new Date().toISOString() })
  } catch (e) {
    console.log('skip', ean, String(e).slice(0, 80))
  }
}
// A full round of ~38 000 pages at one per 10 s takes about two weeks, so keep prices for 21 days.
const keepAfter = new Date(Date.now() - 21 * 86_400_000).toISOString()
const prices = [...fresh.values()]
for (const [ean, p] of prev) if (!fresh.has(ean) && urls.has(ean) && p.checkedAt >= keepAfter) prices.push(p)
console.log(`checked ${fresh.size} of ${urls.size}, kept ${prices.length - fresh.size} earlier prices`)
mkdirSync('public/prices', { recursive: true })
// One product per line, so daily changes stay small in git.
const head = JSON.stringify({ source: 'tokmanni.fi product pages', retailerId: 'tokmanni', fetchedAt: new Date().toISOString() }).slice(0, -1)
writeFileSync('public/prices/tokmanni.json', `${head},"prices":[\n${prices.sort((a, b) => a.ean.localeCompare(b.ean)).map((p) => JSON.stringify(p)).join(',\n')}\n]}\n`)
console.log(`saved ${prices.length} prices`)

// Price history: one point per day when the price changes, last 180 days.
const HISTORY = 'public/prices/tokmanni-history.json'
const history = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, 'utf8')) : {}
const today = new Date().toISOString().slice(0, 10)
const cutoff = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10)
for (const { ean, priceCents } of fresh.values()) {
  const points = (history[ean] ?? []).filter(([d]) => d >= cutoff && d !== today)
  const last = points[points.length - 1]
  if (!last || last[1] !== priceCents) points.push([today, priceCents])
  history[ean] = points
}
writeFileSync(HISTORY, JSON.stringify(history))
console.log(`history for ${Object.keys(history).length} products`)
