const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sites = {
  halpahalli: 'https://www.halpahalli.fi/media/sitemap/sitemap_product.xml',
  minimani: 'https://www.minimani.fi/sitemap/sitemap.xml',
  multitronic: 'https://www.multitronic.fi/sitemap.xml',
  verkkokauppa: 'https://www.verkkokauppa.com/gsitemaps1/sitemap.xml',
  power: 'https://www.power.fi/services/sitemap.xml',
  motonet: 'https://www.motonet.fi/sitemap.xml',
  puuilo: 'https://www.puuilo.fi/media/sitemap/fi_sitemap.xml',
  clasohlson: 'https://www.clasohlson.com/sitemap.xml',
  biltema: 'https://www.biltema.fi/globalassets/sitemaps/sitemapindex-fi.xml',
  prisma: 'https://www.prisma.fi/sitemap.xml',
  rusta: 'https://www.rusta.com/sitemap.xml',
  ikea: 'https://www.ikea.com/sitemaps/sitemap.xml',
  stockmann: 'https://www.stockmann.com/sitemap.xml',
}
const get = async (u) => { try { const r = await fetch(u, { headers: { 'User-Agent': UA } }); const b = Buffer.from(await r.arrayBuffer()); let t = b.toString(); if (u.endsWith('.gz')) { const z = await import('node:zlib'); t = z.gunzipSync(b).toString() } return [r.status, t] } catch (e) { return [0, String(e)] } }
const locs = (x) => [...x.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
function ld(html) {
  const out = []
  for (const [, j] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try { const d = JSON.parse(j); for (const x of [].concat(d['@graph'] ?? d)) if (/Product/.test(x['@type'])) out.push(x) } catch {}
  }
  return out
}
for (const [name, map] of Object.entries(sites)) {
  let [st, x] = await get(map); let urls = locs(x); let depth = 0
  while (urls.length && /sitemap|\.xml/i.test(urls[0]) && depth < 3) {
    const sub = urls.find((u) => /product|tuote|prod|item|sku/i.test(u)) ?? urls[0]
    ;[st, x] = await get(sub); urls = locs(x); depth++
  }
  const prod = urls.filter((u) => !/\.xml/.test(u)).slice(Math.min(5, urls.length - 1))
  const sample = prod[0]
  if (!sample) { console.log('SHOP', name, 'sitemap', st, 'no product urls', urls.length); continue }
  await new Promise((r) => setTimeout(r, 1500))
  const [ps, html] = await get(sample)
  const p = ld(html)[0]
  const offer = p && [].concat(p.offers ?? [])[0]
  const gtin = p && (p.gtin13 ?? p.gtin ?? p.gtin8 ?? p.ean ?? p.gtin12)
  const eanInHtml = html.match(/"(?:ean|gtin13|gtin|ean13|ean_code|barcode)"\s*[:=]\s*"?(\d{8,14})/i)?.[1]
  console.log('SHOP', name, 'urls', urls.length, 'page', ps, 'jsonld', !!p, 'gtin', gtin ?? '-', 'eanInHtml', eanInHtml ?? '-', 'price', offer?.price ?? offer?.lowPrice ?? '-', 'name', (p?.name ?? '').slice(0, 40), sample.slice(0, 90))
}
