// Finds the addresses of Lidl's current leaflets once a day (name, period and
// link of each), so the app can open a leaflet directly. Only the
// link is stored; the leaflet stays on Lidl's own site. robots.txt is honoured.
// Output: public/prices/leaflets.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { datesFrom } from './leafletDates.mjs'

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
  const disallow = rulesFor(await get(base + '/robots.txt').catch(() => ''), 'hintaopasbot')
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
  // A robots.txt that can't be read (e.g. a passing 404) means no rules.
  const main = rulesFor(await get('https://www.tokmanni.fi/robots.txt').catch(() => ''), 'hintaopasbot')
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
// Shops that publish their leaflets with Publitas: the publication page offers a
// cover (og:image) and a title. A Publitas group address always opens the
// newest leaflet. Links on the shop's own leaflet page add the other ones.
const meta2 = (html, prop) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)`, 'i'))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1]
const unescape = (s) => (s ?? '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()
async function publitas(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) return null
  const html = await r.text()
  const image = unescape(meta2(html, 'og:image'))
  const final = r.url.replace(/\/page\/\d+\/?$/, '/')
  let title = unescape(meta2(html, 'og:title') ?? html.match(/<title>([^<]*)<\/title>/i)?.[1])
  title = title.replace(/^.*? - /, '').replace(/ - Sivu \d+$/i, '').replace(/ - Page \d+$/i, '').replace(/_/g, ' ')
  // The cover is the leaflet's own first page (the og:image is a rendered screenshot that
  // can show the wrong thing), and the dates come from the first pages' text.
  let cover = image, from = null, until = null
  try {
    await sleep(800)
    const spreads = await (await fetch(final + 'spreads.json', { headers: { 'User-Agent': UA } })).json()
    const pages = spreads.flatMap((x) => x.pages || [])
    const first = pages[0]?.images
    const src = first?.at600 || first?.at800 || first?.at1000
    // page pictures are served by Publitas' own host, also for Promozilla viewers
    if (src) cover = src.startsWith('http') ? src : 'https://view.publitas.com' + src
    ;[from, until] = datesFrom(pages.slice(0, 2).map((p) => p.text || '').join(' '))
    if (!until) [from, until] = datesFrom(title + ' ' + final)
  } catch { /* keep the og:image */ }
  return cover.startsWith('https://') ? { name: title, url: final, image: cover, ...(until ? { from, until } : {}) } : null
}
async function pageLinks(url) {
  try { return [...new Set([...(await get(url)).matchAll(/https:\/\/view\.publitas\.com\/[a-z0-9-]+\/[a-z0-9_-]+\/?/gi)].map((m) => m[0].replace(/\/?$/, '/')))] } catch { return [] }
}
const SHOPS = {
  minimani: { group: 'https://view.publitas.com/minimani-yhtiot-oy/', pages: ['https://www.minimani.fi/lehti-ilmoitukset-mainoslehti'] },
  rusta: { group: 'https://view.publitas.com/rusta-kuvasto', pages: [] },
  halpahalli: { groups: ['https://view.publitas.com/halpahalli/', 'https://view.publitas.com/halpa-halli/', 'https://view.publitas.com/halpahalli-oy/', 'https://view.publitas.com/kokkolan-halpa-halli/'], pages: ['https://www.halpahalli.fi/mainokset', 'https://www.halpahalli.fi/lelulehti'] },
}
const pubRobots = rulesFor(await get('https://view.publitas.com/robots.txt').catch(() => ''), 'hintaopasbot')
for (const [shop, cfg] of Object.entries(SHOPS)) {
  out[shop] = []
  try {
    const seen = new Set()
    const candidates = [cfg.group, ...(cfg.groups ?? []), ...(await Promise.all(cfg.pages.map(pageLinks))).flat()].filter(Boolean)
    console.log(shop, 'candidates', JSON.stringify(candidates))
    for (const c of candidates.slice(0, 8)) {
      if (pubRobots.some((r) => blockedBy(r, new URL(c).pathname))) continue
      await sleep(1500)
      const l = await publitas(c).catch(() => null)
      if (l && !seen.has(l.url)) { seen.add(l.url); out[shop].push(l) }
    }
  } catch (e) {
    console.log(shop, e.message)
  }
}
// If a source failed this time, keep what it had last time (up to 3 days), so
// leaflets don't vanish from the app because of a passing error.
try {
  const prev = JSON.parse(readFileSync('public/prices/leaflets.json', 'utf8'))
  for (const k of ['lidl', 'tokmanni', 'minimani', 'rusta', 'halpahalli']) {
    const empty = !Array.isArray(out[k]) || out[k].length === 0
    const since = prev.kept?.[k] ?? prev.updated
    if (empty && Array.isArray(prev[k]) && prev[k].length && Date.now() - +new Date(since) < 3 * 86_400_000) {
      out[k] = prev[k]
      out.kept = { ...(out.kept ?? {}), [k]: since }
      console.log('kept previous', k)
    }
  }
} catch { /* first run */ }
console.log('leaflets', JSON.stringify(out))
mkdirSync('public/prices', { recursive: true })
// Tokmanni (iPaper): the share picture is a wide crop; use the leaflet's first page if it can be fetched.
async function ipaperCover(og) {
  try {
    const v = new URL(og).searchParams.get('v')
    const guid = JSON.parse(Buffer.from(v, 'base64').toString()).PaperGuid
    for (const size of ['Normal', 'Zoom', 'Thumbnail']) {
      const u = `https://cdn.ipaper.io/iPaper/Papers/${guid}/Pages/1/${size}.jpg`
      const r = await fetch(u, { headers: { 'User-Agent': UA } })
      if (r.ok && /^image\//.test(r.headers.get('content-type') || '')) { await r.arrayBuffer(); return u }
    }
  } catch { /* keep the share picture */ }
  return null
}
if (Array.isArray(out.tokmanni)) {
  for (const l of out.tokmanni) {
    if (!l.image?.includes('OpenGraphImage')) continue
    await sleep(500)
    const page = await ipaperCover(l.image)
    console.log('tokmanni cover', l.name, page ?? 'kept share picture')
    if (page) l.image = page
  }
}
writeFileSync('public/prices/leaflets.json', JSON.stringify(out) + '\n')
