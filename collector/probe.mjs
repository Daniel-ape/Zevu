// Temporary probe: which grocery web shops publish barcode + price and allow it in robots.txt?
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA } }); return { s: r.status, t: r.ok ? await r.text() : '' } }
const SITES = ['https://www.fiksuruoka.fi', 'https://www.karkkainen.com', 'https://www.kauppahalli24.fi', 'https://www.ruohonjuuri.fi', 'https://www.lidl.fi', 'https://www.tokmanni.fi', 'https://www.minimani.fi', 'https://www.puuilo.fi', 'https://www.motonet.fi', 'https://www.ruokaboksi.fi', 'https://www.makeup.fi', 'https://www.sinituote.fi', 'https://www.apteekki360.fi', 'https://www.yliopistonapteekki.fi', 'https://www.coolshop.fi']
for (const base of SITES) {
  console.log('\n=====', base)
  try {
    const rb = await get(base + '/robots.txt')
    const lines = rb.t.split('\n').map((l) => l.trim())
    console.log('robots', rb.s, 'disallow-all for *?', /user-agent:\s*\*\s*\n(?:[^\n]*\n)*?disallow:\s*\/\s*$/im.test(rb.t))
    const maps = lines.filter((l) => /^sitemap:/i.test(l)).map((l) => l.replace(/^sitemap:\s*/i, ''))
    console.log('sitemaps', maps.slice(0, 5).join(' '))
    console.log('robots head:', lines.filter(Boolean).slice(0, 25).join(' | ').slice(0, 900))
    let queue = maps.length ? maps : [base + '/sitemap.xml'], prod = []
    for (let i = 0; i < 6 && queue.length && prod.length < 3; i++) {
      const m = queue.shift(); const x = await get(m); await sleep(1200)
      const locs = [...x.t.matchAll(/<loc>\s*([^<\s]+)/g)].map((a) => a[1].replace(/&amp;/g, '&'))
      console.log(' map', x.s, m, locs.length)
      const sub = locs.filter((u) => /\.xml/.test(u))
      const pick = sub.filter((u) => /prod|tuote/i.test(u)); queue.push(...(pick.length ? pick : sub).slice(0, 3))
      prod.push(...locs.filter((u) => !/\.xml/.test(u)).filter((u, k, a) => k > a.length / 2).slice(0, 3))
    }
    for (const u of prod.slice(0, 2)) {
      const p = await get(u); await sleep(1500)
      const gt = p.t.match(/"gtin(?:13|8|12|14)?"\s*:\s*"?(\d{8,14})/i)?.[1] ?? p.t.match(/\bean["']?\s*[:=]\s*["']?(\d{8,14})/i)?.[1]
      const pr = p.t.match(/"price"\s*:\s*"?([\d.,]+)/)?.[1]
      console.log(' page', p.s, u, 'gtin=', gt, 'price=', pr, 'jsonld=', /application\/ld\+json/.test(p.t))
    }
  } catch (e) { console.log('error', e.message) }
}
