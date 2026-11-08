// Runs in the installed app's background runner (no web view, no DOM).
// Every few hours: reads the collected store prices from the website and
// notifies when a watched product has become cheaper than when it was watched
// (or than the last price we told the user about).
const LIVE = 'https://daniel-ape.github.io/hintaopas/prices/'
// Packed shop prices (scripts/build-price-bundles.ts): core first, the rest
// only when a watched product wasn't in it.
const FILES = ['app/core.json', 'app/rest.json']
const NAMES = { tokmanni: 'Tokmanni', halpahalli: 'Halpa-Halli', verkkokauppa: 'Verkkokauppa.com', prisma: 'Prisma', stockmann: 'Stockmann', karkkainen: 'Kärkkäinen', ruohonjuuri: 'Ruohonjuuri', yliopistonapteekki: 'Yliopiston Apteekki', lidl: 'Lidl', apteekki360: 'Apteekki360', power: 'Power' }

function readJson(key, fallback) {
  try {
    const got = CapacitorKV.get(key)
    return got && got.value ? JSON.parse(got.value) : fallback
  } catch (e) {
    return fallback
  }
}
const euro = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €'

// Same rules as src/domain/watch.ts (kept in step by hand: the runner has no imports).
const STOP = {}
'ja tai sekä eri lajit lajitelma kpl pkt rs prk pss tlk plo kg g ml cl dl l och med utan the and with uusi new ny koot koko size sorts sort laatu tuote tuotteet miesten naisten lasten erilaisia erilainen valittavana kaikki useita lidl plus tarjous hinta norm esim alk alkaen from från vain only max per talous perhe'
  .split(' ').forEach(function (w) { STOP[w] = true })
function words(name) {
  const out = []
  String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).forEach(function (w) {
    if (w.length >= 3 && !/^\d/.test(w) && !STOP[w] && out.indexOf(w) < 0) out.push(w)
  })
  return out
}
function same(a, b) {
  if (a === b) return true
  const s = a.length <= b.length ? a : b, l = a.length <= b.length ? b : a
  return s.length >= 5 && (l.indexOf(s) === 0 || l.slice(-s.length) === s || (s.length >= 6 && l.indexOf(s) >= 0))
}
function offerIsFor(item, offerName) {
  const pw = words(item.name), ow = words(offerName)
  if (ow.length < 2 || pw.length < 2) return false
  const hit = ow.filter(function (o) { return pw.some(function (p) { return same(o, p) }) })
  if (hit.length / ow.length < 0.6) return false
  const brand = words(item.brand)
  if (!brand.length) return hit.length >= 3
  const isBrand = function (w) { return brand.some(function (b) { return same(w, b) }) }
  if (!hit.some(isBrand)) return false
  const rest = ow.filter(function (o) { return !isBrand(o) }), restHit = hit.filter(function (h) { return !isBrand(h) })
  return restHit.length >= 1 && restHit.length / Math.max(1, rest.length) >= 0.6
}
const CHAINS = { lidl: 'Lidl', tokmanni: 'Tokmanni', minimani: 'Minimani', rusta: 'Rusta', halpahalli: 'Halpa-Halli', karkkainen: 'Kärkkäinen', k: 'K-Ruoka' }

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
    let missing = Object.keys(want).length
    for (const file of FILES) {
      if (!missing) break
      let d
      try {
        const r = await fetch(LIVE + file)
        if (!r.ok) continue
        d = await r.json()
      } catch (e) {
        continue
      }
      for (const s of d.shops || []) {
        for (const it of s.i || []) {
          const ean = it[0], cents = it[1]
          if (!want[ean]) continue
          if (best[ean] === undefined) missing--
          if (best[ean] === undefined || cents < best[ean].cents) best[ean] = { cents: cents, store: s.r }
        }
      }
    }
    const notes = []
    for (const w of watch) {
      const now = best[w.ean]
      if (!now) continue
      const ref = told[w.ean] !== undefined ? told[w.ean] : w.targetCents != null ? null : w.baselineCents
      if (w.targetCents != null) {
        if (now.cents > w.targetCents || (ref != null && now.cents >= ref)) continue
      } else if (ref === null || ref === undefined || now.cents >= ref) continue
      told[w.ean] = now.cents
      const title =
        lang === 'sv' ? 'Billigare nu: ' + w.name : lang === 'en' ? 'Cheaper now: ' + w.name : 'Nyt halvempi: ' + w.name
      const body =
        (lang === 'sv' ? 'Nu ' : lang === 'en' ? 'Now ' : 'Nyt ') + euro(now.cents) + ' (' + euro(ref) + ') · ' + (NAMES[now.store] || now.store)
      notes.push({ id: 1000 + notes.length + (Date.now() % 100000), title, body, scheduleAt: new Date(Date.now() + 1000) })
    }
    // Leaflet offers on watched products, each told once.
    try {
      const r = await fetch(LIVE + 'offers.json')
      if (r.ok) {
        const d = await r.json()
        const toldOffers = readJson('toldOffers', [])
        const today = new Date().toISOString().slice(0, 10)
        for (const o of d.offers || []) {
          if (o.validUntil && o.validUntil < today) continue
          for (const w of watch) {
            const key = w.ean + '|' + o.chain + '|' + o.priceCents + '|' + (o.validUntil || '')
            if (toldOffers.indexOf(key) >= 0 || !offerIsFor(w, o.name)) continue
            toldOffers.push(key)
            const chain = CHAINS[o.chain] || o.chain
            const title = (lang === 'sv' ? 'I ' + chain + '-bladet: ' : lang === 'en' ? 'In the ' + chain + ' leaflet: ' : chain + '-lehdessä: ') + w.name
            const body = euro(o.priceCents) + (o.percent ? ' (−' + o.percent + ' %)' : '') + ' · ' + o.name
            notes.push({ id: 5000 + notes.length + (Date.now() % 100000), title, body, scheduleAt: new Date(Date.now() + 1000) })
          }
        }
        CapacitorKV.set('toldOffers', JSON.stringify(toldOffers.slice(-300)))
      }
    } catch (e) {
      /* no leaflet offers this time */
    }
    CapacitorKV.set('told', JSON.stringify(told))
    if (notes.length) CapacitorNotifications.schedule(notes)
    resolve()
  } catch (e) {
    reject(e)
  }
})
