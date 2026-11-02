// Daily Tokmanni price collector (runs in GitHub Actions).
// Tokmanni's robots.txt allows product pages with a 10 s crawl delay; we
// follow that, identify ourselves, and only fetch products the app knows
// (matched by the barcode at the end of Tokmanni's product URLs).
// Output: public/prices/tokmanni.json, served with the web app.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; grocery price comparison)'
const DELAY = 10_000 // Crawl-delay: 10
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.text()
}

// Respect robots.txt: skip anything it disallows.
const robots = await get('https://www.tokmanni.fi/robots.txt')
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
    if (!known.has(m[1])) continue
    stats.known++
    const path = new URL(u).pathname
    if (allowed(path)) urls.set(m[1], u)
    else if (!stats.blockedExample) stats.blockedExample = `${path} by ${disallow.find((r) => !allowed.call(null, path) && blockedBy(r, path))}`
  }
}
console.log('sitemap stats', JSON.stringify(stats), 'known in app', known.size, 'rules', disallow.length)
console.log(`${urls.size} Tokmanni products match the app's catalogue`)

function priceFrom(html) {
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(json)
      const offer = Array.isArray(d.offers) ? d.offers[0] : d.offers
      if (d['@type'] === 'Product' && offer?.price) return Math.round(parseFloat(offer.price) * 100)
    } catch {
      /* not JSON we understand */
    }
  }
  const m = html.match(/data-price-amount="([\d.]+)"/)
  return m ? Math.round(parseFloat(m[1]) * 100) : null
}

const prices = []
for (const [ean, url] of urls) {
  await sleep(DELAY)
  try {
    const cents = priceFrom(await get(url))
    if (cents && cents > 0 && cents < 100000) prices.push({ ean, priceCents: cents, url })
  } catch (e) {
    console.log('skip', ean, String(e).slice(0, 80))
  }
}
mkdirSync('public/prices', { recursive: true })
writeFileSync(
  'public/prices/tokmanni.json',
  JSON.stringify({ source: 'tokmanni.fi product pages', retailerId: 'tokmanni', fetchedAt: new Date().toISOString(), prices }),
)
console.log(`saved ${prices.length} prices`)

// Price history: one point per day when the price changes, last 180 days.
const HISTORY = 'public/prices/tokmanni-history.json'
const history = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, 'utf8')) : {}
const today = new Date().toISOString().slice(0, 10)
const cutoff = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10)
for (const { ean, priceCents } of prices) {
  const points = (history[ean] ?? []).filter(([d]) => d >= cutoff && d !== today)
  const last = points[points.length - 1]
  if (!last || last[1] !== priceCents) points.push([today, priceCents])
  history[ean] = points
}
writeFileSync(HISTORY, JSON.stringify(history))
console.log(`history for ${Object.keys(history).length} products`)
