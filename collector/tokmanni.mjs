// Daily Tokmanni price collector (runs in GitHub Actions).
// Tokmanni's robots.txt allows product pages with a 10 s crawl delay; we
// follow that, identify ourselves, and only fetch products the app knows
// (matched by the barcode at the end of Tokmanni's product URLs).
// Output: public/prices/tokmanni.json, served with the web app.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

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
const disallow = robots
  .split('\n')
  .filter((l) => /^disallow:/i.test(l))
  .map((l) => l.slice(l.indexOf(':') + 1).trim())
  .filter(Boolean)
const allowed = (path) =>
  !disallow.some((rule) => {
    const re = new RegExp('^' + rule.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))
    return re.test(path)
  })

const known = new Set(JSON.parse(readFileSync('public/products/fi.json', 'utf8')).rows.map((r) => r[0]))
const urls = new Map()
const index = await get('https://www.tokmanni.fi/sitemap/sitemap.xml')
for (const sm of [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])) {
  await sleep(DELAY)
  for (const [, u] of (await get(sm)).matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const m = u.match(/-(\d{8}|\d{13})$/)
    if (m && known.has(m[1]) && allowed(new URL(u).pathname)) urls.set(m[1], u)
  }
}
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
