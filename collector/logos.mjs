// Fetches each chain's own site icon (the logo a browser shows for the site), so offers can
// show which store they are from. Saved as public/logos/<chain>.<ext> with an index
// (public/logos/index.json). Existing icons are kept; robots.txt is honoured.
// S and K are left out: their sites ask bots to stay away.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const SITES = {
  lidl: 'https://www.lidl.fi/',
  rusta: 'https://www.rusta.com/',
  minimani: 'https://www.minimani.fi/',
  halpahalli: 'https://www.halpahalli.fi/',
  tokmanni: 'https://www.tokmanni.fi/',
  karkkainen: 'https://www.karkkainen.com/',
  stockmann: 'https://www.stockmann.com/',
  verkkokauppa: 'https://www.verkkokauppa.com/',
  ruohonjuuri: 'https://www.ruohonjuuri.fi/',
  apteekki360: 'https://www.apteekki360.fi/',
  yliopistonapteekki: 'https://www.yliopistonapteekki.fi/',
  // square icon for small round marks, next to Tokmanni's wide header logo
  'tokmanni-icon': 'https://www.tokmanni.fi/',
}
// Chains whose site icon is not their logo: use the logo in the page header instead.
const HEADER_LOGO = new Set(['tokmanni'])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(u) {
  await sleep(1000)
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000), redirect: 'follow' })
  if (!r.ok) throw new Error(`${r.status} ${u}`)
  return r
}
async function allowed(site) {
  const origin = new URL(site).origin
  try {
    const txt = await (await get(origin + '/robots.txt')).text()
    let mine = false, all = false
    for (const raw of txt.split('\n')) {
      const line = raw.replace(/#.*/, '').trim()
      const [k, ...v] = line.split(':'); const val = v.join(':').trim()
      if (/^user-agent$/i.test(k)) { all = val === '*'; mine = /hintaopas/i.test(val) }
      else if (/^disallow$/i.test(k) && (all || mine) && val === '/') return false
    }
  } catch { /* no robots.txt */ }
  return true
}

mkdirSync('public/logos', { recursive: true })
let index = {}
try { index = JSON.parse(readFileSync('public/logos/index.json', 'utf8')) } catch {}

for (const [chain, site] of Object.entries(SITES)) {
  if (index[chain] && existsSync('public/logos/' + index[chain])) continue
  try {
    if (!(await allowed(site))) { console.log(chain, 'robots.txt says no'); continue }
    const html = await (await get(site)).text()
    let headerLogos = []
    if (HEADER_LOGO.has(chain)) {
      // 1) an inline <svg> inside the header's logo link
      const a = html.match(/<a\b[^>]*class=["'][^"']*logo[^"']*["'][^>]*>([\s\S]{0,20000}?)<\/a>/i)?.[1] ?? ''
      const svg = a.match(/<svg[\s\S]*?<\/svg>/i)?.[0]
      if (svg && svg.length > 200) {
        const full = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
        writeFileSync(`public/logos/${chain}.svg`, full)
        index[chain] = `${chain}.svg`
        console.log(chain, '← inline header svg', full.length, 'bytes')
        continue
      }
      // 2) a logo picture in the header, or the theme's usual logo file
      const imgs = [...(a + html).matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]).map((t) => t.match(/\b(?:data-)?src=["']([^"']+)/i)?.[1]).filter((u) => u && /logo/i.test(u) && !/^data:/.test(u))
      const theme = html.match(/https?:\/\/[^"' ]*\/static\/version\d+\/frontend\/[^"' ]*?\/[a-z]{2}_[A-Z]{2}\//)?.[0]
      const guesses = theme ? ['images/logo.svg', 'images/logo.png', 'images/logo-header.svg'].map((f) => theme + f) : []
      headerLogos = [...imgs, ...guesses].map((u) => ({ url: new URL(u.replace(/&amp;/g, '&'), site).href, score: 2000 }))
    }
    if (headerLogos.length) console.log(chain, 'header logos', headerLogos.map((c) => c.url))
    // <link rel="apple-touch-icon" | "icon" ... href="..." sizes="..."> — prefer big PNG/SVG icons
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((l) => /rel=["'][^"']*icon/i.test(l))
    const cand = links.map((l) => {
      const href = l.match(/href=["']([^"']+)/i)?.[1]
      const size = +(l.match(/sizes=["'](\d+)/i)?.[1] || 0)
      const score = (/apple-touch/i.test(l) ? 400 : 0) + (/\.svg/i.test(href || '') ? 300 : 0) + Math.min(size, 256) + (/\.ico/i.test(href || '') ? -100 : 0)
      return href && { url: new URL(href.replace(/&amp;/g, '&'), site).href, score }
    }).filter(Boolean).concat(headerLogos).sort((a, b) => b.score - a.score)
    cand.push({ url: new URL('/favicon.ico', site).href, score: -1000 })
    for (const c of cand) {
      try {
        const r = await get(c.url)
        const type = r.headers.get('content-type') || ''
        const buf = Buffer.from(await r.arrayBuffer())
        if (buf.length < 100 || buf.length > 400e3) continue
        const ext = /svg/.test(type) || /\.svg/i.test(c.url) ? 'svg' : /png/.test(type) || /\.png/i.test(c.url) ? 'png' : /jpe?g/.test(type) ? 'jpg' : /icon|ico/.test(type) || /\.ico/i.test(c.url) ? 'ico' : /webp/.test(type) ? 'webp' : null
        if (!ext) continue
        writeFileSync(`public/logos/${chain}.${ext}`, buf)
        index[chain] = `${chain}.${ext}`
        console.log(chain, '←', c.url, buf.length, 'bytes')
        break
      } catch { /* try the next one */ }
    }
    if (!index[chain]) console.log(chain, 'no icon found')
  } catch (e) { console.log(chain, 'skip', String(e).slice(0, 120)) }
}
writeFileSync('public/logos/index.json', JSON.stringify(index) + '\n')
