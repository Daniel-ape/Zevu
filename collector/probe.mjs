// TEMPORARY: where do Gigantti, Power, Verkkokauppa and Kärkkäinen publish leaflets, and may prices be read?
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(u) {
  await sleep(1200)
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(30000), redirect: 'follow' })
    const t = await r.text()
    console.log(`-- ${r.status} ${t.length}b ${r.url}`)
    return r.ok ? t : ''
  } catch (e) { console.log('-- ERR', u, String(e).slice(0, 100)); return '' }
}
const links = (html, base, re) => [...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => { try { return new URL(m[1].replace(/&amp;/g, '&'), base).href } catch { return '' } }).filter((u) => re.test(u)))].slice(0, 25)
const SITES = {
  gigantti: 'https://www.gigantti.fi/',
  power: 'https://www.power.fi/',
  verkkokauppa: 'https://www.verkkokauppa.com/',
  karkkainen: 'https://www.karkkainen.com/verkkokauppa/',
}
const LEAF = /lehti|kuvasto|mainos|tarjou|kampanj|catalog|katalog|publitas|ipaper|issuu|flipp|leaflet|brochure/i
for (const [name, site] of Object.entries(SITES)) {
  console.log('\n=====', name)
  const robots = await get(new URL('/robots.txt', site).href)
  console.log(robots.split('\n').filter((l) => /^(user-agent|disallow|allow|sitemap|crawl)/i.test(l.trim())).slice(0, 40).join('\n'))
  const home = await get(site)
  console.log('leaflet-ish links:', JSON.stringify(links(home, site, LEAF), null, 0))
  console.log('external viewers:', JSON.stringify([...new Set(home.match(/https?:\/\/[a-z0-9.-]*(publitas|ipaper|issuu|flipp|paperturn|flipsnack|tjek|etilbud|lehtiluukku)[^"' <)]*/gi) || [])].slice(0, 10)))
  console.log('json-ld product/offer:', /"@type"\s*:\s*"(Product|Offer)"/.test(home), 'next-data:', /__NEXT_DATA__/.test(home))
}
// Kärkkäinen's leaflet page
for (const u of ['https://www.karkkainen.com/verkkokauppa/info/karkkainen-oy/nakoislehti', 'https://www.karkkainen.com/verkkokauppa/nakoislehti', 'https://www.gigantti.fi/kampanjat', 'https://www.power.fi/kampanjat/', 'https://www.power.fi/mainoslehti/', 'https://www.gigantti.fi/mainoslehti']) {
  const h = await get(u)
  if (h) {
    console.log('leaflet-ish:', JSON.stringify(links(h, u, LEAF).slice(0, 15)))
    console.log('viewers:', JSON.stringify([...new Set(h.match(/https?:\/\/[a-z0-9.-]*(publitas|ipaper|issuu|flipp|paperturn|flipsnack|tjek|lehtiluukku)[^"' <)]*/gi) || [])].slice(0, 10)))
  }
}
