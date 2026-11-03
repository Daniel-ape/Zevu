const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const pages = ['https://www.halpahalli.fi/lelulehti', 'https://www.halpahalli.fi/mainokset', 'https://www.halpahalli.fi/mainos', 'https://www.halpahalli.fi/tarjoukset',
  'https://www.rusta.com/fi-fi/kuvasto', 'https://view.publitas.com/minimani-yhtiot-oy/', 'https://www.minimani.fi/mainokset', 'https://www.minimani.fi/lelukuvasto.html',
  'https://www.puuilo.fi/mainos', 'https://www.puuilo.fi/kampanjat', 'https://www.motonet.fi/kampanjat', 'https://www.motonet.fi/mainos', 'https://www.power.fi/kampanjat/', 'https://www.biltema.fi/kampanjat/']
const meta = (h, p) => h.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i'))?.[1] ?? h.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, 'i'))?.[1]
for (const u of pages) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA } }); const h = await r.text()
    const links = [...new Set([...h.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map((m) => m[1]))].filter((l) => /publitas|ipaper|issuu|flipp|\.pdf|mainos|kuvasto|lehti|catalog/i.test(l) && !/lehtipuh|lehtikom|lehtiö|reklam/i.test(l)).slice(0, 15)
    console.log('PAGE', u, r.status, r.url !== u ? '-> ' + r.url : '', 'og:image', (meta(h, 'og:image') ?? '').slice(0, 100), 'title', (h.match(/<title>([^<]*)/)?.[1] ?? '').trim().slice(0, 60), JSON.stringify(links))
  } catch (e) { console.log('PAGE', u, 'ERR', String(e).slice(0, 80)) }
  await new Promise((r) => setTimeout(r, 1500))
}
