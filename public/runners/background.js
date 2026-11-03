// Runs in the installed app's background runner (no web view, no DOM).
// Every few hours: reads the collected store prices from the website and
// notifies when a watched product has become cheaper than when it was watched
// (or than the last price we told the user about).
const LIVE = 'https://daniel-ape.github.io/hintaopas/prices/'
// Every shop the collectors cover (collector/*.mjs).
const FILES = ['tokmanni.json', 'halpahalli.json', 'verkkokauppa.json', 'prisma.json', 'stockmann.json', 'karkkainen.json', 'ruohonjuuri.json', 'yliopistonapteekki.json', 'lidl.json', 'apteekki360.json']
const NAMES = { tokmanni: 'Tokmanni', halpahalli: 'Halpa-Halli', verkkokauppa: 'Verkkokauppa.com', prisma: 'Prisma', stockmann: 'Stockmann', karkkainen: 'Kärkkäinen', ruohonjuuri: 'Ruohonjuuri', yliopistonapteekki: 'Yliopiston Apteekki', lidl: 'Lidl', apteekki360: 'Apteekki360' }

function readJson(key, fallback) {
  try {
    const got = CapacitorKV.get(key)
    return got && got.value ? JSON.parse(got.value) : fallback
  } catch (e) {
    return fallback
  }
}
const euro = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €'

// The app sends the watch list here whenever it changes.
addEventListener('syncWatch', (resolve, reject, args) => {
  try {
    CapacitorKV.set('watch', JSON.stringify((args && args.items) || []))
    if (args && args.lang) CapacitorKV.set('lang', args.lang)
    resolve()
  } catch (e) {
    reject(e)
  }
})

addEventListener('checkPrices', async (resolve, reject) => {
  try {
    const watch = readJson('watch', [])
    if (!watch.length) return resolve()
    const lang = (CapacitorKV.get('lang') || {}).value || 'fi'
    const told = readJson('told', {})
    const best = {}
    const want = {}
    for (const w of watch) want[w.ean] = true
    for (const file of FILES) {
      let d
      try {
        const r = await fetch(LIVE + file)
        if (!r.ok) continue
        d = await r.json()
      } catch (e) {
        continue
      }
      for (const p of d.prices || []) {
        if (!want[p.ean]) continue
        if (best[p.ean] === undefined || p.priceCents < best[p.ean].cents) best[p.ean] = { cents: p.priceCents, store: d.retailerId }
      }
    }
    const notes = []
    for (const w of watch) {
      const now = best[w.ean]
      if (!now) continue
      const ref = told[w.ean] !== undefined ? told[w.ean] : w.baselineCents
      if (ref === null || ref === undefined || now.cents >= ref) continue
      told[w.ean] = now.cents
      const title =
        lang === 'sv' ? 'Billigare nu: ' + w.name : lang === 'en' ? 'Cheaper now: ' + w.name : 'Nyt halvempi: ' + w.name
      const body =
        (lang === 'sv' ? 'Nu ' : lang === 'en' ? 'Now ' : 'Nyt ') + euro(now.cents) + ' (' + euro(ref) + ') · ' + (NAMES[now.store] || now.store)
      notes.push({ id: 1000 + notes.length + (Date.now() % 100000), title, body, scheduleAt: new Date(Date.now() + 1000) })
    }
    CapacitorKV.set('told', JSON.stringify(told))
    if (notes.length) CapacitorNotifications.schedule(notes)
    resolve()
  } catch (e) {
    reject(e)
  }
})
