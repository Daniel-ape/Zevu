import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
const log = []
const list = await (await fetch('http://localhost:9222/json')).json()
const ws = new WebSocket((list.find((t) => t.type === 'page') ?? list[0]).webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0; const wait = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') log.push('EXCEPTION ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).split('\n')[0])
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') log.push('console.error: ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200)) }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (e) => { const r = await Promise.race([send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }), new Promise((res) => setTimeout(() => res({ timeout: true }), 5000))]); if (r.timeout) { log.push('  (page not answering: ' + e.slice(0, 40) + ')'); return undefined } return r.result?.result?.value }
await send('Runtime.enable')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (e, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(e)) return true; await sleep(100) } return false }
const tap = async (sel, n = 0) => {
  const r = await ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${n}]; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`)
  if (!r) { log.push('  (missing ' + sel + ')'); return }
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 })
}
const back = async () => { execSync('adb shell input keyevent 4'); await sleep(1200) }
let shot = 0
const snap = (n) => { try { execSync(`adb exec-out screencap -p > out/${String(++shot).padStart(2, '0')}-${n}.png`) } catch {} }
const check = (name, ok) => { log.push((ok ? 'PASS ' : 'FAIL ') + name); writeFileSync('out/check.txt', log.join('\n')) }
const where = () => ev(`location.hash + (document.querySelector('.pd-name') ? ' product' : '') + (document.querySelector('.sheet-backdrop') ? ' sheet' : '')`)

snap('welcome-dark-mode')
check('welcome shown first', await ev(`!!document.querySelector('.welcome')`))
check('no location question over welcome (posAsked unset)', await ev(`localStorage.getItem('hintaopas:posAsked') === null`))
await ev(`[...document.querySelectorAll('.welcome button')].find((b) => /without|utan|ilman/i.test(b.textContent))?.click()`)
await until(`!!document.querySelector('.dock')`)
await sleep(3000)
snap('home')
check('light page in dark mode', await ev(`getComputedStyle(document.body).backgroundColor !== 'rgb(0, 0, 0)' && matchMedia('(prefers-color-scheme: dark)').matches !== undefined`))
log.push('  theme media dark: ' + await ev(`matchMedia('(prefers-color-scheme: dark)').matches`))
// back from a product page
await tap('.dock .tab', 1); await sleep(1200)
await tap('.search input'); await send('Input.insertText', { text: 'kahvi' }); await sleep(4000)
log.push('  keyboard open -> dock hidden: ' + await ev(`document.documentElement.classList.contains('kb-open')`) + ' inner ' + await ev('innerHeight'))
snap('typing')
execSync('adb shell input keyevent 111'); await sleep(800)
await until(`document.querySelectorAll('.sr-card').length > 0`)
await tap('.sr-open'); await until(`!!document.querySelector('.pd-name')`)
await back()
check('back: product page -> search', (await where()).startsWith('#search') && !(await where()).includes('product'))
// back closes a sheet
await tap('.dock .tab', 0); await sleep(1500)
await tap('.sc2, .sc'); await sleep(1200)
const sheetOpen = await ev(`!!document.querySelector('.sheet-backdrop')`)
await back()
check('back: closes sheet (opened=' + sheetOpen + ')', !(await ev(`!!document.querySelector('.sheet-backdrop')`)))
// back from another tab goes Home
await tap('.dock .tab', 3); await sleep(1200)
await back()
check('back: other tab -> home', (await where()).startsWith('#home'))
// back on Home leaves to the launcher, app keeps running
await back(); await sleep(1500)
const fg = execSync('adb shell dumpsys activity activities | grep -E "topResumedActivity|mResumedActivity" | head -1').toString()
check('back on home: app goes to background (' + fg.trim().slice(0, 90) + ')', !fg.includes('fi.hintaopas.app'))
execSync('adb shell am start -n fi.hintaopas.app/.MainActivity'); await sleep(3000)
snap('reopened-3s'); await sleep(6000); snap('reopened-9s')
log.push('  after reopen: ' + await where())
log.push('  heap MB ' + await ev(`performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1`))
writeFileSync('out/check.txt', log.join('\n'))
ws.close()
