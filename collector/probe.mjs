const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const pages = ['https://www.halpahalli.fi/', 'https://www.puuilo.fi/', 'https://www.motonet.fi/', 'https://www.rusta.com/fi-fi', 'https://www.clasohlson.com/fi/',
  'https://www.biltema.fi/', 'https://www.power.fi/', 'https://www.verkkokauppa.com/', 'https://www.stockmann.com/', 'https://www.minimani.fi/', 'https://www.prisma.fi/',
  'https://www.jimms.fi/', 'https://www.multitronic.fi/', 'https://www.ikea.com/fi/fi/']
for (const u of pages) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA } }); const h = await r.text()
    const links = [...new Set([...h.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))]
      .filter((l) => /ipaper|issuu|flipp|mainos|lehti|kuvasto|esite|tarjouslehti|flyer|catalog|katalog|leaflet|digilehti|reklam/i.test(l)).slice(0, 12)
    console.log('PAGE', u, r.status, JSON.stringify(links))
  } catch (e) { console.log('PAGE', u, 'ERR', String(e).slice(0, 80)) }
  await new Promise((r) => setTimeout(r, 1500))
}
