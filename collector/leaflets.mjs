// Finds the address of Lidl's current nationwide leaflet once a day, so the
// app can open the leaflet itself instead of the list of leaflets. Only the
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

const out = { updated: new Date().toISOString(), lidl: null }
try {
  const base = 'https://www.lidl.fi'
  const page = '/c/tarjouslehdet/s10019134'
  const disallow = rulesFor(await get(base + '/robots.txt'), 'hintaopasbot')
  if (disallow.some((r) => blockedBy(r, page))) throw new Error('robots.txt disallows the leaflet page')
  const html = await get(base + page)
  const hrefs = [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))]
  const cand = hrefs.filter((h) => /esite|flyer|leaflet|tarjouslehti|prospekt/i.test(h) && !h.endsWith(page))
  console.log('candidate links:', JSON.stringify(cand.slice(0, 30)))
  const pick = cand.find((h) => /koko-suomen/i.test(h)) ?? cand.find((h) => /\/l\/fi\//.test(h))
  if (pick) {
    const url = new URL(pick, base).href
    if (!disallow.some((r) => blockedBy(r, new URL(url).pathname))) out.lidl = url
  }
} catch (e) {
  console.log('lidl:', e.message)
}
console.log('leaflets', JSON.stringify(out))
mkdirSync('public/prices', { recursive: true })
writeFileSync('public/prices/leaflets.json', JSON.stringify(out) + '\n')
