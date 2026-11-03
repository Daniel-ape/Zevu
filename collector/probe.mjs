const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sites = ['https://www.halpahalli.fi', 'https://www.k-rauta.fi', 'https://www.multitronic.fi', 'https://www.verkkokauppa.com', 'https://www.gigantti.fi',
  'https://www.power.fi', 'https://www.motonet.fi', 'https://www.puuilo.fi', 'https://www.clasohlson.com', 'https://www.biltema.fi', 'https://www.prisma.fi',
  'https://www.rusta.com', 'https://www.jimms.fi', 'https://www.minimani.fi', 'https://www.ikea.com', 'https://www.bauhaus.fi', 'https://www.stockmann.com',
  'https://www.tokmanni.fi', 'https://www.lidl.fi', 'https://www.s-kaupat.fi', 'https://www.k-ruoka.fi']
const get = async (u) => { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, redirect: 'follow' }); return [r.status, await r.text()] } catch (e) { return [0, String(e)] } }
for (const s of sites) {
  const [rs, robots] = await get(s + '/robots.txt')
  const lines = robots.split('\n').map((l) => l.trim())
  const star = []; let inStar = false; let anyAll = false
  for (const l of lines) {
    const [k, ...v] = l.split(':'); const val = v.join(':').trim()
    if (/^user-agent$/i.test(k)) inStar = val === '*'
    else if (inStar && /^disallow$/i.test(k)) { star.push(val); if (val === '/') anyAll = true }
  }
  const delay = lines.find((l) => /^crawl-delay/i.test(l)) ?? ''
  const maps = lines.filter((l) => /^sitemap:/i.test(l)).map((l) => l.slice(8).trim()).slice(0, 4)
  console.log('SITE', s, 'robots', rs, 'disallowAll', anyAll, 'rules', star.length, delay, 'maps', JSON.stringify(maps))
}
