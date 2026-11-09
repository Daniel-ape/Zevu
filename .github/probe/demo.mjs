// Walks through the app at a calm pace while the screen is being recorded.
import { execSync } from 'node:child_process'
const list = await (await fetch('http://localhost:9222/json')).json()
const target = list.find((t) => t.type === 'page') ?? list[0]
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0; const wait = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id) } }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (expr, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return; await sleep(100) } }
const dpr = await ev('devicePixelRatio')
// taps on the element's place
const tap = async (sel, n = 0) => {
  const r = await ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${n}]; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`)
  if (!r) { console.log('missing', sel); return }
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] })
  await sleep(60)
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
const swipe = (from, to, ms = 450) => execSync(`adb shell input swipe 540 ${from} 540 ${to} ${ms}`)
const dock = (i) => tap('.dock .tab', i)

await sleep(1500)
swipe(1700, 900); await sleep(1500); swipe(900, 1700); await sleep(1200)
await dock(1); await sleep(1800)
await tap('.search input'); await sleep(700)
await send('Input.insertText', { text: 'kahvi' }); await until(`document.querySelectorAll('.sr-card').length > 0`); await sleep(1800)
execSync('adb shell input keyevent 111'); await sleep(600) // hide keyboard
await tap('.sr-open', 0); await sleep(2500)
await tap('.pd-add'); await sleep(1200)
swipe(1800, 700, 600); await sleep(1500); swipe(1800, 700, 600); await sleep(2000)
await tap('.alt-card .alt-open', 0); await sleep(2500)
execSync('adb shell input keyevent 4'); await sleep(1800) // Android back
execSync('adb shell input keyevent 4'); await sleep(1800)
await dock(3); await sleep(2200) // Lista (tabs: hem, produkter, skanna, lista, blad)
await dock(4); await sleep(2500)
swipe(1700, 900); await sleep(1500)
await dock(2); await sleep(2200)
await dock(0); await sleep(2000)
ws.close()
