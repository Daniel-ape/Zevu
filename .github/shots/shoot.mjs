import { chromium, devices } from 'playwright'
const U = 'https://daniel-ape.github.io/hintaopas/'
const eans = ['0843536180910','3600541944671','4002359020988','4011800420413','4023103195189','4014400910063']
const b = await chromium.launch()
for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: scheme, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent })
  await ctx.addInitScript((eans) => {
    if (localStorage.getItem('seeded')) return
    localStorage.clear(); localStorage.setItem('seeded', '1')
    const s = (k, v) => localStorage.setItem('hintaopas:' + k, JSON.stringify(v))
    localStorage.setItem('hintaopas:welcomed', '1'); s('lang', 'sv')
    s('lists', [{ id: 'l1', name: 'Veckohandling', items: eans.map((e, i) => ({ productId: 'off:' + e, quantity: i === 0 ? 2 : 1 })) }]); s('activeList', 'l1')
    const now = new Date()
    const mk = (d, store, rid, items) => ({ id: 'r' + d + store, retailerId: rid, storeName: store, date: new Date(now.getFullYear(), now.getMonth(), Math.min(d, now.getDate())).toISOString(), totalCents: null, importedAt: now.toISOString(), items })
    const it = (e, c) => ({ productId: 'off:' + e, name: 'Vara', priceCents: c, quantity: 1 })
    s('receipts', [mk(2, 'Tokmanni', 'tokmanni', [it(eans[0], 699), it(eans[1], 289), it(eans[4], 1049)]), mk(5, 'Halpa-Halli', 'halpahalli', [it(eans[2], 349), it(eans[3], 279), it(eans[5], 249)])])
    s('watched', [{ productId: 'off:' + eans[1], baselineCents: 299, since: now.toISOString(), targetCents: 239 }, { productId: 'off:' + eans[2], baselineCents: 349, since: now.toISOString() }, { productId: 'off:' + eans[4], baselineCents: 1099, since: now.toISOString() }])
  }, eans)
  const p = await ctx.newPage()
  const shot = async (name, wait = 3500) => { await p.waitForTimeout(wait); await p.screenshot({ path: `shots/${scheme}-${name}.png` }); console.log('shot', scheme, name) }
  const go = async (hash) => { await p.goto(U + '#' + hash); await p.waitForTimeout(500) }
  try { await go('home'); await p.reload(); await shot('home', 7000) } catch (e) { console.log(e.message) }
  try { await go('search'); await p.fill('.search input', 'kahvi'); await shot('search', 4000) } catch (e) { console.log(e.message) }
  try { await p.click('.search-row >> nth=0'); await shot('product', 4000) } catch (e) { console.log(e.message) }
  try { await go('lists'); await shot('lists') } catch (e) { console.log(e.message) }
  try { await go('leaflets'); await shot('leaflets', 6000) } catch (e) { console.log(e.message) }
  try { await go('home'); await p.waitForTimeout(2500); await p.click('.sc'); await shot('savings', 3000) } catch (e) { console.log(e.message) }
  try { await go('home'); await p.waitForTimeout(2500); await p.click('.bell-btn'); await shot('watched', 3000) } catch (e) { console.log(e.message) }
  try { await go('search'); await p.fill('.search input', ''); await p.click('.cat-btn'); await shot('categories', 1500) } catch (e) { console.log(e.message) }
  await ctx.close()
}
await b.close()
