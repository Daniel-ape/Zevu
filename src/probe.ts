// Automatic walk-through of the app, only in special test builds
// (VITE_PROBE=1, built by .github/workflows/probe.yml). It taps through the
// main screens like a person would and logs how long each step takes and any
// error, so the iPhone simulator and the Android emulator can test the app.
/* eslint-disable no-console */
type Nav = { go: (t: string, o?: object) => void; openProduct: (id: string) => void; back: () => void }
const w = window as unknown as { __zevuNav?: Nav; __probeErrors?: string[] }

const log = (...a: unknown[]) => console.log('PROBE', ...a)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
const pane = () => document.querySelector('.tab-pane:not([hidden])') ?? document
async function until(ok: () => boolean, max = 20000) {
  const t0 = performance.now()
  while (!ok()) { if (performance.now() - t0 > max) return -1; await sleep(16) }
  return Math.round(performance.now() - t0)
}
async function shot(name: string) { log('SHOT', name); await sleep(2600) }
async function step(name: string, fn: () => Promise<string | number | void>) {
  const t0 = performance.now()
  try { const r = await fn(); log('STEP', name, 'ms=' + Math.round(performance.now() - t0), r ?? '') }
  catch (e) { log('FAIL', name, String(e)) }
}

export async function runProbe() {
  w.__probeErrors = []
  addEventListener('error', (e) => log('ERROR', e.message))
  addEventListener('unhandledrejection', (e) => log('ERROR', 'rejection', String(e.reason)))
  try { if (localStorage.getItem('hintaopas:welcomed') !== '1') { localStorage.setItem('hintaopas:welcomed', '1'); location.reload(); return } } catch { /* */ }
  const t0 = performance.now()
  log('START', navigator.userAgent, innerWidth + 'x' + innerHeight)
  const navMs = await until(() => !!w.__zevuNav, 30000)
  const nav = w.__zevuNav!
  const loaded = await until(() => !!document.querySelector('.tab-pane:not([hidden]) .screen') && !document.querySelector('#splash'), 30000)
  log('STEP', 'startup', 'ms=' + Math.round(performance.now() - t0), 'nav ' + navMs, 'ui ' + loaded)
  await sleep(3000)
  await shot('01-home')

  await step('tab-search', async () => { nav.go('search'); await frame(); return await until(() => !!pane().querySelector('.search input')) })
  await step('search-maito', async () => {
    const inp = pane().querySelector('.search input') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    set.call(inp, 'maito'); inp.dispatchEvent(new Event('input', { bubbles: true }))
    const ms = await until(() => pane().querySelectorAll('.sr-add').length > 3)
    return ms + ' results=' + pane().querySelectorAll('.sr-add').length
  })
  await shot('02-search')
  for (let k = 0; k < 3; k++) await step('add-' + k, async () => {
    const b = pane().querySelectorAll('.sr-add')[k] as HTMLElement
    b.click(); return await until(() => b.classList.contains('in'), 5000)
  })
  await shot('03-added')
  await step('open-product', async () => {
    (pane().querySelector('.sr-open') as HTMLElement).click()
    return await until(() => !!document.querySelector('.pd-add, .alt-strip, .pd-credit'))
  })
  await sleep(800)
  await shot('04-product')
  await step('back', async () => { nav.back(); await frame(); return await until(() => !!pane().querySelector('.search input')) })

  await step('tab-lists', async () => { nav.go('lists'); return await until(() => pane().querySelectorAll('.stepper').length > 0) })
  await step('stepper-plus', async () => {
    const st = pane().querySelector('.stepper')!; const n = () => st.querySelector('.n')?.textContent
    const before = n(); (st.querySelectorAll('button')[1] as HTMLElement).click()
    return await until(() => n() !== before, 5000)
  })
  await step('stepper-minus', async () => {
    const st = pane().querySelector('.stepper')!; const n = () => st.querySelector('.n')?.textContent
    const before = n(); (st.querySelectorAll('button')[0] as HTMLElement).click()
    return await until(() => n() !== before, 5000)
  })
  await sleep(800)
  await shot('05-list')

  await step('tab-leaflets', async () => { nav.go('leaflets'); return (await until(() => pane().querySelectorAll('.cover, .lf-group').length > 0)) + ' groups=' + pane().querySelectorAll('.lf-group').length })
  await sleep(1500)
  await shot('06-leaflets')
  await step('tab-home', async () => { nav.go('home'); return await until(() => !!pane().querySelector('.screen')) })

  await step('stress-60-taps', async () => {
    const tabs = ['home', 'search', 'lists', 'leaflets']
    for (let i = 0; i < 60; i++) { nav.go(tabs[(i * 7) % 4]); await sleep(25 + (i % 5) * 20) }
    nav.go('home')
    return await until(() => location.hash === '#home', 5000)
  })
  await step('responsive-after-stress', async () => {
    const a = performance.now(); await frame(); await frame(); return Math.round(performance.now() - a)
  })
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
  log('STEP', 'memory', mem ? Math.round(mem.usedJSHeapSize / 1048576) + ' MB' : 'n/a')
  await shot('07-after-stress')
  log('DONE')
}
