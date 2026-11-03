// Finds the addresses of Lidl's current leaflets once a day (name, period and
// link of each), so the app can open a leaflet directly. Only the
// link is stored; the leaflet stays on Lidl's own site. robots.txt is honoured.
// Output: public/prices/leaflets.json
import { writeFileSync, mkdirSync } from 'node:fs'

const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; grocery price comparison)'
const get = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.text()
}
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
const blockedBy = (rule, path) =>
  new RegExp('^' + rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')).test(path)

// Each leaflet on Lidl's page is an <a class="flyer"> with a name and a period.
const text = (h) => h.replace(/<[^>]+>/g, '').replace(/&#x20;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const out = { updated: new Date().toISOString(), lidl: [] }
try {
  const base = 'https://www.lidl.fi'
  const page = '/c/tarjouslehdet/s10019134'
  const disallow = rulesFor(await get(base + '/robots.txt'), 'hintaopasbot')
  const ok = (path) => !disallow.some((r) => blockedBy(r, path))
  if (!ok(page)) throw new Error('robots.txt disallows the leaflet page')
  const html = await get(base + page)
  const seen = new Set()
  for (const m of html.matchAll(/<a\s+href="([^"]+)"[^>]*class="flyer"[\s\S]*?<\/a>/g)) {
    const url = new URL(m[1].replace(/&amp;/g, '&'), base).href
    if (seen.has(url) || !url.startsWith(base) || !ok(new URL(url).pathname)) continue
    seen.add(url)
    const name = text(m[0].match(/class="flyer__name">([\s\S]*?)<\/div>/)?.[1] ?? '')
    const period = text(m[0].match(/class="flyer__title">([\s\S]*?)<\/span>/)?.[1] ?? '')
    // The small cover picture Lidl itself shows for the leaflet (first page).
    const img = m[0].match(/class="flyer__image"[^>]*src="([^"]+)"/)?.[1] ?? m[0].match(/src="(https:\/\/imgproxy\.leaflets\.schwarz\/[^"]+)"/)?.[1]
    const image = img?.startsWith('https://imgproxy.leaflets.schwarz/') ? img : undefined
    if (name) out.lidl.push({ name, period, url, image })
  }
} catch (e) {
  console.log('lidl:', e.message)
}
// Tokmanni: its leaflet page links to every current leaflet (Tarjoussanomat,
// Ruokasanomat, seasonal catalogues...). Each leaflet's own page offers a
// cover picture for link previews (og:image) and a title.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const meta = (html, prop) =>
  html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`, 'i'))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${prop}"`, 'i'))?.[1]
out.tokmanni = []
try {
  const main = rulesFor(await get('https://www.tokmanni.fi/robots.txt'), 'hintaopasbot')
  if (main.some((r) => blockedBy(r, '/tarjouslehti'))) throw new Error('robots.txt disallows the leaflet page')
  const list = await get('https://www.tokmanni.fi/tarjouslehti')
  const viewer = 'https://tarjoussanomat.tokmanni.fi'
  const vrules = rulesFor(await get(viewer + '/robots.txt').catch(() => ''), 'hintaopasbot')
  const links = [...new Set([...list.matchAll(/href="(https:\/\/tarjoussanomat\.tokmanni\.fi\/[^"#?]+)"/g)].map((m) => m[1]))]
  for (const url of links.slice(0, 12)) {
    if (vrules.some((r) => blockedBy(r, new URL(url).pathname))) continue
    await sleep(3000)
    try {
      const html = await get(url)
      const title = text(meta(html, 'og:title') ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '')
        .replace(/^Lue uusin\s+/i, '')
      const image = meta(html, 'og:image')?.replace(/&amp;/g, '&')
      // A readable name from the address when the page has no useful title.
      const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? ''
      const fromSlug = slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
      out.tokmanni.push({ name: title && !/^tokmanni$/i.test(title) ? title : fromSlug, url, image: image?.startsWith('https://') ? image : undefined })
    } catch (e) {
      console.log('tokmanni leaflet', url, e.message)
    }
  }
} catch (e) {
  console.log('tokmanni:', e.message)
}
console.log('leaflets', JSON.stringify(out))
mkdirSync('public/prices', { recursive: true })
writeFileSync('public/prices/leaflets.json', JSON.stringify(out) + '\n')
