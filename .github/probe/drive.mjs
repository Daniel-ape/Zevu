// Drives the app's web view over the Chrome DevTools protocol: real taps at
// element positions, typing, timings, console errors and screenshots.
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
const log = []
const list = await (await fetch('http://localhost:9222/json')).json()
const target = list.find((t) => t.type === 'page') ?? list[0]
log.push('target ' + target.url)
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0; const wait = new Map()
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') log.push('EXCEPTION ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).split('\n')[0])
  if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) log.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Runtime.enable')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (expr, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return Date.now() - t; await sleep(100) } throw new Error('timeout: ' + expr) }
const tap = async (sel, n = 0) => {
  const r = await ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${n}]; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`)
  if (!r) throw new Error('not found: ' + sel)
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 })
}
let shot = 1
const snap = (name) => { try { execSync(`adb exec-out screencap -p > out/${String(++shot).padStart(2, '0')}-${name}.png`) } catch {} }
const step = async (name, fn) => { const t0 = Date.now(); try { await fn(); log.push(`OK   ${name} ${Date.now() - t0} ms`) } catch (e) { log.push(`FAIL ${name}: ${e.message}`) } }
const dockBtn = (i) => tap('.dock button, .dock a', i)

await step('start', async () => { await until(`!!document.querySelector('.welcome, .dock')`, 20000) })
await step('welcome', async () => { if (await ev(`!!document.querySelector('.welcome')`)) { await ev(`localStorage.setItem('hintaopas:welcomed','1'); localStorage.setItem('hintaopas:lang','"sv"'); location.reload()`); await sleep(6000) } await until(`!!document.querySelector('.dock')`, 20000) })
snap('home')
for (const [i, n] of [[1, 'produkter'], [2, 'lista'], [3, 'blad'], [0, 'hem']]) await step('tab ' + n, async () => { await dockBtn(i); await sleep(900) })
await step('search', async () => {
  await dockBtn(1); await sleep(800); await tap('.search input'); await send('Input.insertText', { text: 'kahvi' })
  log.push('     results after ' + (await until(`document.querySelectorAll('.sr-card').length > 0`)) + ' ms')
})
snap('search')
await step('open product', async () => { await tap('.sr-open'); await until(`!!document.querySelector('.pd-name')`) })
snap('product')
await step('add to list', async () => { await tap('.pd-add'); await sleep(500) })
await step('alternatives row', async () => { const n = await ev(`document.querySelectorAll('.alt-card').length`); log.push('     alt cards ' + n) })
await step('back', async () => { await tap('.topbar .icon-btn'); await until(`[...document.querySelectorAll('.sr-card')].some((e) => e.offsetParent)`) })
await step('list', async () => { await dockBtn(2); await sleep(1200) })
snap('list')
await step('leaflets', async () => { await dockBtn(3); await until(`document.querySelectorAll('.cover').length > 0`, 20000) })
snap('leaflets')
await step('open leaflet', async () => { await tap('.cover'); await sleep(3000) })
snap('leaflet-open')
await step('android back', async () => { execSync('adb shell input keyevent 4'); await sleep(1500); log.push('     after back: ' + (await ev(`location.hash + ' dock=' + !!document.querySelector('.dock')`))) })
await step('stress tabs', async () => { for (let k = 0; k < 24; k++) { await dockBtn(k % 4); await sleep(90) } await sleep(2000); log.push('     dock still there: ' + (await ev(`!!document.querySelector('.dock')`))) })
await step('scan', async () => { await tap('.dock-scan'); await sleep(2500) })
snap('scan')
await step('memory', async () => { log.push('     heap MB ' + (await ev(`performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1`))) })
writeFileSync('out/drive.txt', log.join('\n'))
ws.close()
