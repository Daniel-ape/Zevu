import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const log = []
const b = await chromium.connectOverCDP('http://localhost:9222')
const ctx = b.contexts()[0]; const p = ctx.pages()[0]
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(m.type() + ': ' + m.text()) })
p.on('pageerror', (e) => log.push('PAGEERROR: ' + e.message))
const step = async (name, fn) => {
  const t0 = Date.now()
  try { await fn(); log.push(`OK ${name} ${Date.now() - t0}ms`) } catch (e) { log.push(`FAIL ${name}: ${e.message.split('\n')[0]}`) }
}
log.push('url ' + p.url())
await step('welcome', async () => { const w = p.locator('.welcome button').last(); if (await w.count()) { await w.click(); await p.waitForTimeout(1500) } })
await step('home', async () => { await p.waitForSelector('.dock', { timeout: 15000 }) })
const dock = (n) => p.locator('.dock button, .dock a').nth(n)
for (const [i, n] of [[1, 'produkter'], [2, 'lista'], [3, 'blad'], [0, 'hem']]) await step('tab ' + n, async () => { await dock(i).click(); await p.waitForTimeout(1200) })
await step('search', async () => { await dock(1).click(); await p.waitForTimeout(800); await p.fill('.search input', 'kahvi'); await p.waitForSelector('.sr-card', { timeout: 15000 }) })
await step('open product', async () => { await p.locator('.sr-open').first().click(); await p.waitForSelector('.pd-name', { timeout: 10000 }) })
await step('add to list', async () => { await p.locator('.pd-add').first().click(); await p.waitForTimeout(600) })
await step('back', async () => { await p.locator('.topbar .icon-btn').first().click(); await p.waitForSelector('.sr-card', { state: 'visible', timeout: 10000 }) })
await step('leaflets', async () => { await dock(3).click(); await p.waitForSelector('.cover', { timeout: 15000 }) })
await step('open leaflet', async () => { await p.locator('.cover').first().click(); await p.waitForTimeout(2500) })
await step('memory', async () => { const m = await p.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1); log.push('heap MB ' + m) })
// rapid tab switching to shake out races
await step('stress tabs', async () => { for (let k = 0; k < 20; k++) { await dock(k % 4).click(); await p.waitForTimeout(120) } await p.waitForTimeout(1500) })
log.push('final url ' + p.url())
writeFileSync('out/drive.txt', log.join('\n'))
await b.close().catch(() => {})
