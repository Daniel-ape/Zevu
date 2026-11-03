import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })
p.on('console', (m) => console.log('CONSOLE', m.type(), m.text()))
p.on('requestfailed', (r) => console.log('FAILED', r.url().slice(0, 120), r.failure()?.errorText))
await p.goto('https://daniel-ape.github.io/hintaopas/#leaflets', { waitUntil: 'networkidle' })
await p.waitForTimeout(4000)
const info = await p.evaluate(() => [...document.querySelectorAll('.section')].map((s) => ({
  h: s.querySelector('h2')?.textContent,
  covers: [...s.querySelectorAll('.cover')].map((c) => ({ n: c.querySelector('.cover-name')?.textContent, img: c.querySelector('img') ? [c.querySelector('img').complete, c.querySelector('img').naturalWidth, c.querySelector('img').src.slice(0, 60)] : 'blank' })),
})))
console.log('INFO', JSON.stringify(info))
await b.close()
