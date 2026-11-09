import { chromium } from 'playwright'
// The website (app) as on an iPhone Pro Max: 440×956 points, 3× pixels, real safe areas.
const U = 'https://daniel-ape.github.io/hintaopas/app/'
const eans = ['0843536180910','3600541944671','4002359020988','4011800420413','4023103195189','4014400910063']
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1' })
await ctx.addInitScript((eans) => {
  if (localStorage.getItem('seeded')) return
  localStorage.clear(); localStorage.setItem('seeded', '1')
  const s = (k, v) => localStorage.setItem('hintaopas:' + k, JSON.stringify(v))
  localStorage.setItem('hintaopas:welcomed', '1'); s('lang', 'sv'); localStorage.setItem('hintaopas:posAsked', 'denied')
  s('lists', [{ id: 'l1', name: 'Veckohandling', items: eans.map((e, i) => ({ productId: 'off:' + e, quantity: i === 0 ? 2 : 1 })) }]); s('activeList', 'l1')
  const now = new Date()
  const mk = (d, store, rid, items) => ({ id: 'r' + d + store, retailerId: rid, storeName: store, date: new Date(now.getFullYear(), now.getMonth(), Math.min(d, now.getDate())).toISOString(), totalCents: null, importedAt: now.toISOString(), items })
  const it = (e, c) => ({ productId: 'off:' + e, name: 'Vara', priceCents: c, quantity: 1 })
  s('receipts', [mk(2, 'Tokmanni', 'tokmanni', [it(eans[0], 699), it(eans[1], 289), it(eans[4], 1049)]), mk(5, 'Halpa-Halli', 'halpahalli', [it(eans[2], 349), it(eans[3], 279), it(eans[5], 249)])])
  s('watched', [{ productId: 'off:' + eans[1], baselineCents: 299, since: now.toISOString(), targetCents: 239 }, { productId: 'off:' + eans[2], baselineCents: 349, since: now.toISOString() }, { productId: 'off:' + eans[4], baselineCents: 1099, since: now.toISOString() }])
}, eans)
const p = await ctx.newPage()
const cdp = await ctx.newCDPSession(p)
await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 62, bottom: 34, left: 0, right: 0 } })
const shot = async (name, wait = 3500) => { await p.waitForTimeout(wait); await p.screenshot({ path: `shots/${name}.png` }); console.log('shot', name) }
const go = async (hash) => { await p.goto(U + '#' + hash); await p.waitForTimeout(500) }
try { await go('home'); await p.reload(); await shot('home', 8000) } catch (e) { console.log(e.message) }
try { await go('search'); await p.fill('.search input', 'kahvi'); await shot('search', 4500) } catch (e) { console.log(e.message) }
try { await p.click('.sr-open >> nth=0'); await shot('product', 4500) } catch (e) { console.log(e.message) }
try { await p.evaluate(() => window.scrollTo(0, 99999)); await shot('product-bottom', 2500) } catch (e) { console.log(e.message) }
try { await go('lists'); await shot('lists') } catch (e) { console.log(e.message) }
try { await go('leaflets'); await shot('leaflets', 7000) } catch (e) { console.log(e.message) }
try { await go('home'); await p.waitForTimeout(3000); await p.click('.sc2, .sc'); await shot('savings', 3000) } catch (e) { console.log(e.message) }
try { await go('home'); await p.waitForTimeout(3000); await p.click('.bell-btn'); await shot('watched', 3000) } catch (e) { console.log(e.message) }
await b.close()
