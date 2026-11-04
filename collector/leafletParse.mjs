// Reads offers (name, price, regular price, member price) from a leaflet PDF's text with
// word positions (pdftotext -bbox-layout). Leaflets are laid out as boxes around a big
// price, so every text line is given to the price nearest to it, and the biggest
// non-boilerplate lines in that group become the product name.

const num = (s) => Number(String(s).replace(',', '.'))
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

export function pagesOf(html) {
  const pages = []
  for (const pm of html.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)) {
    const lines = []
    for (const lm of pm[3].matchAll(/<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/line>/g)) {
      const words = [...lm[5].matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
        .map((w) => ({ x0: +w[1], y0: +w[2], x1: +w[3], y1: +w[4], t: dec(w[5]) }))
      if (words.length) lines.push({ x0: +lm[1], y0: +lm[2], x1: +lm[3], y1: +lm[4], h: +lm[4] - +lm[2], words, text: words.map((w) => w.t).join(' ') })
    }
    pages.push({ w: +pm[1], h: +pm[2], lines })
  }
  return pages
}

const MEMBER = [
  [/lidl\s*plus/i, 'Lidl Plus'],
  [/plussa/i, 'K-Plussa'],
  [/s-?\s?etukorti|bonus/i, 'S-Etukortti'],
  [/etukorti|etuasiakka|kanta-?asiakka|jäsenhint|jäsenetu|klubi|club/i, 'Kanta-asiakas'],
  [/kuponki|kupongi/i, 'Kuponki'],
]
// Lines that are never a product name.
const END = '(?![\\p{L}\\d])'
const JUNK = new RegExp(
  '^\\W*(saatavana|useita|sisä|valittavana|digitarjo|maks|alk|erätuotteita|sesongin|poikkeuksellisen|klubitarjous|säästä|lidl plus|-?äpillä|aktivoi|kuponki|erä|uutuus|nyt|vain|tarjous|hinta|norm|yksitt|alkaen|€|kpl|pkt|pss|rs|ps|plo|prk|tlk|sis|kg|l|pack|katso|hurjat|juhla|edullista|hillitön|tästä|yksinmyynnissä|niin paljon|ota \\d|viikko|vko|lisää|diili|xxl)' + END +
  '|^\\d+(?:[,.]\\d+)?\\s?(-?pack|kpl|pkt|pss|rs|prk|x|osaa|litraa|m|cm)' + END + '|^\\/|voimassa|tarjoukset|rajoitus|kannattaa|v1jan|\\d+\\/20\\d\\d|^\\W*$|^[\\d\\s,.%€/()–-]+$', 'iu')
const SIZE = /\b\d+(?:[,.]\d+)?\s?(?:-\s?\d+(?:[,.]\d+)?\s?)?(?:g|kg|ml|cl|dl|l|kpl|rl|m|cm|mm|w)\b/i

/** "Torkkupeitto Florentina Erittäin pehmeä, …" → "Torkkupeitto Florentina" */
function tidyName(n) {
  n = n.replace(/\s+/g, ' ').replace(/(\p{L})- (\p{Ll})/gu, '$1$2').replace(/\s*\|\s*$/, '').trim()
  const words = n.split(' ')
  if (n.length > 34) {
    const dot = n.search(/\.\s+\p{Lu}/u)
    if (dot > 6) return n.slice(0, dot)
    // a new sentence starts with a capitalised ordinary word after the name
    for (let i = 2; i < words.length; i++) {
      if (/^\p{Lu}\p{Ll}{3,}/u.test(words[i]) && /\p{Ll}/u.test(words[i - 1]) && i >= 2) return words.slice(0, i).join(' ')
    }
  }
  return words.slice(0, 9).join(' ')
}

/** Big price words on a page, joined with their small cent digits. */
function pricesOf(page) {
  const words = page.lines.flatMap((l) => l.words.map((w) => ({ ...w, h: w.y1 - w.y0 })))
  const hs = words.map((w) => w.h).sort((a, b) => a - b)
  const median = hs[Math.floor(hs.length / 2)] || 8
  const big = Math.max(median * 2.2, page.h * 0.022)
  const out = []
  const used = new Set()
  const supOf = new Map()
  for (const w of words) {
    if (w.h < big || !/^\d{1,3}$/.test(w.t)) continue
    const sup = words.find((v) => v !== w && !used.has(v) && /^\d{2}$/.test(v.t) && v.h < w.h * 0.8 && v.h > w.h * 0.25 && v.x0 >= w.x1 - w.h * 0.15 && v.x0 - w.x1 < w.h * 0.6 && Math.abs(v.y0 - w.y0) < w.h * 0.45)
    if (sup) { supOf.set(w, sup); used.add(sup) }
  }
  // "-50 %" / "SÄÄSTÄ 26 %": a number with a % sign right after it
  const isPercent = (w) => words.some((v) => /^%/.test(v.t) && v.x0 >= w.x1 - 2 && v.x0 - w.x1 < w.h * 0.8 && v.y0 < w.y1 && v.y1 > w.y0) || /%$/.test(w.t)
  for (const w of words) {
    if (w.h < big || used.has(w) || isPercent(w)) continue
    let cents = null
    let m
    if ((m = w.t.match(/^(\d{1,3})[.,](\d{2})$/))) cents = +m[1] * 100 + +m[2]
    else if ((m = w.t.match(/^(\d{1,3})[.,]?-?$/))) {
      // superscript cents: a smaller 2-digit word just right of it, top-aligned
      const sup = supOf.get(w)
      if (sup) cents = +m[1] * 100 + +sup.t
      else if (/^\d{3,4}$/.test(w.t)) cents = Math.floor(+w.t / 100) * 100 + (+w.t % 100) // "199" = 1,99 with raised cents
      else cents = +m[1] * 100 // whole euros: "10 €"
    }
    if (cents == null || cents <= 0 || cents > 500000) continue
    if (/^\d{4}$/.test(w.t) && +w.t >= 1990 && +w.t <= 2035) continue // a year
    out.push({ cents, x: (w.x0 + w.x1) / 2, y: (w.y0 + w.y1) / 2, w, h: w.h })
  }
  // "10" followed by a dash and a big "%" is a discount, not a price.
  return out.filter((p) => !page.lines.some((l) => l.words.includes(p.w) && /%/.test(l.text) && !/€/.test(l.text)))
}

export function offersOf(html) {
  const offers = []
  pagesOf(html).forEach((page, pi) => {
    const prices = pricesOf(page)
    if (!prices.length) return
    const groups = prices.map(() => [])
    for (const l of page.lines) {
      if (l.words.some((w) => prices.some((p) => p.w === w))) continue
      const cx = (l.x0 + l.x1) / 2, cy = (l.y0 + l.y1) / 2
      let best = -1, bd = Infinity, second = Infinity
      prices.forEach((p, i) => {
        // text sits above or left of its price more often than below it
        const dy = cy - p.y
        const d = Math.hypot(cx - p.x, dy > 0 ? dy * 1.6 : dy)
        if (d < bd) { second = bd; bd = d; best = i } else if (d < second) second = d
      })
      // lines about as close to two prices belong to neither name for sure
      if (best >= 0 && bd < page.w * 0.45) groups[best].push({ ...l, sure: bd < second * 0.8 })
    }
    prices.forEach((p, i) => {
      const g = groups[i]
      const all = g.map((l) => l.text).join(' | ')
      const named = g.filter((l) => l.sure && /[a-zåäö]{3}/i.test(l.text) && !JUNK.test(l.text.trim()) && !/!\s*$|^\s*[•(]|\d+[,.]\d{2}/.test(l.text) && l.text.length < 70)
      if (!named.length) return
      // name: the largest lines (headline + brand), top to bottom
      const maxH = Math.max(...named.map((l) => l.h))
      let name = named.filter((l) => l.h >= maxH * 0.7 && !SIZE.test(l.text) || l.h >= maxH * 0.95)
        .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0).slice(0, 3).map((l) => l.text).join(' ')
      name = tidyName(name)
      if (name.length < 3 || /•/.test(name) || !/\p{L}{4}/u.test(name)) return
      const details = named.filter((l) => l.h < maxH * 0.7 && SIZE.test(l.text)).map((l) => l.text).slice(0, 2).join(' ').replace(/\s+/g, ' ')
      // regular price: "norm. 2,79", "(5,99)", or a smaller decimal near the price that is higher
      let regular = null
      const nm = all.match(/(?:norm\.?|ovh\.?|yksitt\.?)\s*(\d+[,.]\d{2})/i) || all.match(/\((\d+[,.]\d{2})\)/)
      if (nm) regular = Math.round(num(nm[1]) * 100)
      if (!regular) {
        // "2,67 €/kg" next to the price is a price per kilo, not the regular price
        const perUnit = (w) => g.some((l) => l.words.includes(w) && new RegExp(w.t.replace('.', '\\.') + '\\s?€?\\s?\\/\\s?(kg|l)', 'i').test(l.text))
        const small = g.flatMap((l) => l.words).filter((w) => /^\d+[.,]\d{2}$/.test(w.t) && !perUnit(w) && Math.hypot(w.x0 - p.x, w.y0 - p.y) < p.h * 2.5).map((w) => Math.round(num(w.t) * 100))
        regular = small.find((c) => c > p.cents && c < p.cents * 3) ?? null
      }
      if (regular && (regular <= p.cents || regular > p.cents * 4)) regular = null
      const pm = all.match(/-\s?(\d{1,2})\s?%/) || all.match(/säästä\D{0,12}(\d{1,2})\s?%/i)
      const member = MEMBER.find(([re]) => re.test(all))?.[1] ?? null
      const printed = pm ? +pm[1] : null
      const computed = regular ? Math.round((1 - p.cents / regular) * 100) : null
      // a regular price must agree with a printed discount, and a lone one must be believable
      if (regular && (printed !== null ? Math.abs(computed - printed) > 5 : computed > 60)) regular = null
      offers.push({
        page: pi + 1, name, details: details || null, priceCents: p.cents, regularCents: regular,
        percent: printed ?? (regular ? computed : null),
        member,
      })
    })
  })
  // the same product printed twice on a spread
  const seen = new Set()
  return offers.filter((o) => { const k = o.name.toLowerCase() + o.priceCents; if (seen.has(k)) return false; seen.add(k); return true })
}
