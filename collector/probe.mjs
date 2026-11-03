// Temporary probe: which Finnish web shops publish barcode + price and allow it in robots.txt?
import { gunzipSync } from 'node:zlib'
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }); if (!r.ok) return { s: r.status, t: '' }; const b = Buffer.from(await r.arrayBuffer()); let t; try { t = /\.gz($|\?)/.test(u) ? gunzipSync(b).toString() : b.toString() } catch { t = b.toString() } return { s: r.status, t } }
function prod(html) {
  for (const [, j] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(j) } catch { continue }
    for (const x of [].concat(d['@graph'] ?? d)) {
      if (!x || !/Product/.test([].concat(x['@type']).join(' '))) continue
      const g = [].concat(x.gtin13 ?? x.gtin ?? x.gtin8 ?? x.gtin12 ?? x.ean ?? []).map(String).find((g) => /^\d{8,14}$/.test(g)) ?? html.match(/["'](?:ean|ean13|gtin|gtin13|barcode)["']\s*[:=]\s*["']?(\d{8,14})/i)?.[1]
      const o = [].concat(x.offers ?? [])[0]
      return { g, p: o?.price ?? o?.lowPrice, img: !!x.image }
    }
  }
  return { g: html.match(/["'](?:ean|ean13|gtin|gtin13|barcode)["']\s*[:=]\s*["']?(\d{8,14})/i)?.[1] }
}
function robotsVerdict(t) {
  const groups = []; let cur = null
  for (const raw of t.split('\n')) { const line = raw.replace(/#.*/, '').trim(); const [k, ...r] = line.split(':'); const v = r.join(':').trim()
    if (/^user-agent$/i.test(k)) { if (!cur || cur.rules.length) groups.push((cur = { a: [], rules: [] })); cur.a.push(v.toLowerCase()) } else if (cur && /^disallow$/i.test(k) && v) cur.rules.push(v) }
  const g = groups.filter((x) => x.a.includes('*')); return { n: g.flatMap((x) => x.rules).length, all: g.some((x) => x.rules.includes('/')) }
}
const SITES = process.argv.slice(2)
for (const base of SITES) {
  const out = [base]
  try {
    const rb = await get(base + '/robots.txt'); const v = robotsVerdict(rb.t)
    out.push(`robots=${rb.s} rules=${v.n}${v.all ? ' DISALLOW-ALL' : ''}`)
    if (v.all) { console.log(out.join(' | ')); continue }
    const maps = [...rb.t.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1])
    let queue = maps.length ? maps : [base + '/sitemap.xml'], pages = [], seen = 0, picked = []
    for (let i = 0; i < 8 && queue.length && pages.length < 4; i++) {
      const m = queue.shift(); const x = await get(m); await sleep(800); seen++
      const locs = [...x.t.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s\]]+)/g)].map((a) => a[1].replace(/&amp;/g, '&'))
      const sub = locs.filter((u) => /\.xml/.test(u)); const pr = sub.filter((u) => /prod|tuote|item|artikk/i.test(u))
      queue = [...(pr.length ? pr : sub).slice(0, 3), ...queue]
      const pg = locs.filter((u) => !/\.xml/.test(u)); if (pg.length) { pages.push(...pg.filter((_, k) => k % Math.max(1, Math.floor(pg.length / 4)) === 1).slice(0, 4)); picked.push(`${m} (${locs.length})`) }
    }
    out.push('maps: ' + picked.join(', '))
    for (const u of pages.slice(0, 3)) { const p = await get(u); await sleep(1500); const r = prod(p.t); out.push(`${p.s} ${u.slice(0, 90)} gtin=${r.g ?? '-'} price=${r.p ?? '-'}`) }
  } catch (e) { out.push('error ' + e.message) }
  console.log(out.join('\n   '))
}
