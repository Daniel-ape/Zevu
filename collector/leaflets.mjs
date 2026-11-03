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
    if (name) out.lidl.push({ name, period, url })
  }
} catch (e) {
  console.log('lidl:', e.message)
}
console.log('leaflets', JSON.stringify(out))
mkdirSync('public/prices', { recursive: true })
writeFileSync('public/prices/leaflets.json', JSON.stringify(out) + '\n')
