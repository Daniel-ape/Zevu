// Temporary: do shop pages show the regular price next to a sale price?
const UA = 'HintaopasBot/0.1 (+https://github.com/Daniel-ape/hintaopas; price comparison)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }); return r.ok ? r.text() : '' }
import { readFileSync } from 'node:fs'
for (const shop of ['halpahalli', 'tokmanni', 'karkkainen', 'ruohonjuuri', 'prisma', 'verkkokauppa', 'stockmann', 'apteekki360', 'yliopistonapteekki']) {
  let d; try { d = JSON.parse(readFileSync(`public/prices/${shop}.json`, 'utf8')) } catch { continue }
  const urls = d.prices.filter((p) => p.url).slice(0, 400).map((p) => p.url)
  let found = 0, checked = 0
  for (const u of urls.filter((_, i) => i % 40 === 0).slice(0, 10)) {
    await sleep(3500); const h = await get(u); if (!h) continue; checked++
    const hits = {
      oldPrice: h.match(/data-price-type="oldPrice"[^>]*data-price-amount="([\d.]+)"/)?.[1],
      compareAt: h.match(/"compare_at_price"\s*:\s*(\d+)/)?.[1],
      highPrice: h.match(/"highPrice"\s*:\s*"?([\d.]+)/)?.[1],
      strike: h.match(/(norm\.?|ovh\.?|normaalihinta|alkuperäinen hinta|ord\. pris)[^<]{0,40}?(\d+[,.]\d{2})/i)?.[0],
      priceValidUntil: h.match(/"priceValidUntil"\s*:\s*"([^"]+)"/)?.[1],
      memberPrice: /jäsenhinta|club price|etuhinta|kanta-asiakas/i.test(h),
    }
    const any = Object.values(hits).some(Boolean); if (any) found++
    console.log(shop, u.slice(0, 70), JSON.stringify(hits))
  }
  console.log('==', shop, 'pages with sale info', found, 'of', checked)
}
