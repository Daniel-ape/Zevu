// Receipt import: turns the text of a digital receipt (from K-Ruoka,
// S-mobiili, Lidl Plus...) into line items, the store and the date.
// Prices that can be linked to a product become user-reported price
// observations, so they show up in comparisons with their real source.

import type { PriceObservation, Product, Retailer } from './types'

export interface ReceiptItem {
  name: string
  quantity: number
  priceCents: number // line total after discounts
  productId?: string
}

export interface Receipt {
  id: string
  retailerId: string | null
  storeName: string
  date: string // ISO
  items: ReceiptItem[]
  totalCents: number | null
  importedAt: string
}

const STORE_PATTERNS: Array<[RegExp, string]> = [
  [/k-?\s?citymarket/i, 'k-citymarket'],
  [/k-?\s?supermarket/i, 'k-supermarket'],
  [/k-?\s?market/i, 'k-market'],
  [/prisma/i, 'prisma'],
  [/s-?\s?market/i, 's-market'],
  [/\balepa\b/i, 'alepa'],
  [/\bsale\b/i, 'sale'],
  [/\blidl\b/i, 'lidl'],
  [/tokmanni/i, 'tokmanni'],
  [/halpa-?\s?hall?i|\bhalpa\b/i, 'halpahalli'],
  [/k[aä]rkk[aä]inen/i, 'karkkainen'],
]

// A shop's business ID (Y-tunnus) is printed on every receipt and survives when the name is misread.
const BUSINESS_IDS: Array<[RegExp, string]> = [[/0955220[-–]?7/, 'halpahalli']]

// Lines that are never products.
const SKIP = /(yhteens|summa|\btotal|\balv\b|\bvero\b|kortti|k[aä]teinen|vaihtoraha|takaisin|maksettu|\bvisa\b|mastercard|debit|credit|bonus|pisteet|kuitti|y-tunnus|\bpuh\b|\bkassa\b|\bnetto\b|brutto|veroton|verollinen|\bmoms\b|att betala|\bkort\b|kontant|tilinumero|arkistointi|\bviite|kiitos|tervetuloa|\bpantti\b|\bpant\b)/i
// Also OCR-damaged forms ("HTEENSÄ", "YHTEENSA").
const TOTAL = /(y?hteens[aä]|yhteens|summa\b|total|att betala|maksettava)/i
const PAYMENT = /(kortti|k[aä]teinen|pankki|card|visa|master|debit|credit|kontant|maksukortti)/i
const DISCOUNT = /(alennus|etu\b|tarjous|rabatt|plussa|kampanja|s[aä][aä]st[oö]|lidl plus|-\d+\s?%)/i
// Deposit refunds are money back, not a discount on the item above.
const REFUND = /(palautus|pantti|\bpant\b|returglas|pullonpalautus)/i
// The price may be followed by a VAT code ("2,40 14", "1,29 A") and stray OCR marks.
const PRICE_AT_END = /(-?\d{1,4}[,.]\d{2})(-?)\s*(€|eur)?\s*(?:[A-D]|\d{1,2})?(?:\s+(?:[^\w\s]{1,3}|[a-z*]{1,2}))?\s*$/i
const QTY_LINE = /^\s*(\d+)\s*(kpl|st|x)\s*[x*]?\s*(\d+[,.]\d{2})/i
// "1,00x 5,99 Ale 60%  -3,59": unit price and discount of the item above, whose price is already net.
// Also with OCR slips: "1,007 —=—4,49 Ale", "1,00% — 3,99 Ae 608".
const ALE_LINE = /^\W*(?:\S\s+)?\d{1,3}[,.]\d{2,3}\S?\s*[—–=\-\s]*\d+[,.]\d{2}\s+(?:a[l1i]?e\b|-?\d{1,2}\s?[%x])/i
const WEIGHT_LINE = /^\s*\d+[,.]\d+\s*kg\b/i
const DATE = /\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/

const cents = (s: string) => Math.round(parseFloat(s.replace(',', '.')) * 100)
// Price at the end of a line; "0,50-" (minus after the number) counts as negative.
const priceOf = (m: RegExpMatchArray) => (m[2] === '-' ? -1 : 1) * cents(m[1])

/** Fix common OCR slips in prices: "1, 29" → "1,29", "O,95" → "0,95", "l,29" → "1,29". */
export function cleanOcrLine(line: string): string {
  return line
    .replace(/(\d)\s*([,.])\s+(\d{2})\b/g, '$1$2$3')
    .replace(/(^|\s)[Oo](?=[,.]\d{2}\b)/g, '$10')
    .replace(/(^|\s)[lI|](?=[,.]?\d*[,.]\d{2}\b)/g, '$11')
    .replace(/(\d[,.])[Oo](\d)|(\d[,.]\d)[Oo]\b/g, (_m, a, b, c) => (a ? a + '0' + b : c + '0'))
}

export function parseReceipt(text: string, now = new Date()): Omit<Receipt, 'id' | 'importedAt'> {
  const lines = text.split(/\r?\n/).map((l) => cleanOcrLine(l.replace(/\s+/g, ' ').trim())).filter(Boolean)

  let retailerId: string | null = null
  let storeName = ''
  for (const line of lines.slice(0, 12)) {
    const hit = STORE_PATTERNS.find(([re]) => re.test(line))
    if (hit) { retailerId = hit[1]; storeName = line; break }
  }
  if (!retailerId) {
    const byId = BUSINESS_IDS.find(([re]) => lines.slice(0, 15).some((l) => re.test(l)))
    if (byId) retailerId = byId[1]
  }

  let date = now
  for (const line of lines) {
    const m = line.match(DATE)
    if (m) {
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
      const d = new Date(y, +m[2] - 1, +m[1], 12)
      if (!isNaN(+d) && d <= now) { date = d; break }
    }
  }

  const items: ReceiptItem[] = []
  let totalCents: number | null = null
  let pending = '' // item name whose price is on the next line ("2 KPL X 0,95   1,90")
  const paid: number[] = [] // amounts on the payment lines after the total
  for (const [k, line] of lines.entries()) {
    if (TOTAL.test(line)) {
      const p = line.match(PRICE_AT_END)
      if (p) totalCents = priceOf(p)
      for (const next of lines.slice(k + 1, k + 5)) {
        const q = PAYMENT.test(next) && next.match(PRICE_AT_END)
        if (q) paid.push(priceOf(q))
      }
      break // everything after the total is payment info
    }
    if (ALE_LINE.test(line)) {
      // The item above already shows the price after this discount, unless it shows the full unit price.
      const unit = line.match(/\d[,.]\d{2,3}\S?\s*[—–=\-\s]*(\d+[,.]\d{2})/)
      const off = line.match(/-\s?(\d+[,.]\d{2})\W*$/)
      const last = items[items.length - 1]
      if (last && unit && off && last.priceCents === cents(unit[1])) last.priceCents -= cents(off[1])
      pending = ''
      continue
    }
    const p = line.match(PRICE_AT_END)
    const qty = line.match(QTY_LINE)
    if (qty || WEIGHT_LINE.test(line)) {
      // Quantity or weight line. A price at its end (not the unit price) is the line total.
      const lineTotal = p ? priceOf(p) : null // a line ending in "€/KG" has no total
      const n = qty ? +qty[1] : 1
      if (pending && lineTotal !== null) items.push({ name: pending, quantity: n, priceCents: lineTotal })
      else if (items.length && qty) items[items.length - 1].quantity = n
      pending = ''
      continue
    }
    if (!p) {
      // A product name without a price: its price may follow on the next line.
      pending = line.length >= 3 && !SKIP.test(line) && /[a-zåäö]{3}/i.test(line) ? line : ''
      continue
    }
    pending = ''
    // "e POSSUN FILEEPIHVI", ") PERLSMUOVIKASSI": drop OCR crumbs before the name
    const name = line.slice(0, p.index).trim().replace(/^(?:[^\p{L}\p{N}]+\s*|\p{Ll}\s+(?=\p{Lu}))+/u, '').replace(/[\s.,;:|]+$/, '').trim()
    const value = priceOf(p)
    if (REFUND.test(name)) continue
    // Discounts: negative amounts, or a discount word printed with a plain amount ("ALENNUS 0,30").
    if (value < 0 || (DISCOUNT.test(name) && items.length && name.split(' ').length <= 3)) {
      // a "discount" bigger than the item is a misread line, not a discount
      const last = items[items.length - 1]
      if (last && Math.abs(value) < last.priceCents) last.priceCents -= Math.abs(value)
      continue
    }
    if (!name || name.length < 2 || SKIP.test(name) || /^\d+$/.test(name)) continue
    items.push({ name, quantity: 1, priceCents: value })
  }

  // A digit misread in the total ("16,67" for "16,07"): when the items add up to
  // what was paid by card or cash, that is the total.
  const sum = items.reduce((a, i) => a + i.priceCents, 0)
  if (items.length && totalCents !== sum && paid.includes(sum)) totalCents = sum
  if (totalCents === null && paid.length) totalCents = paid[0]

  return { retailerId, storeName, date: date.toISOString(), items, totalCents }
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim()
}

/** Key under which a receipt line's link to a product is remembered. */
export const lineKey = (name: string) => norm(name).replace(/\b\d+([.,]\d+)?\s?(kg|g|l|dl|cl|ml|kpl|pcs|st)\b/g, '').replace(/\s+/g, ' ').trim()

const UNITS = /^(\d+([.,]\d+)?(kg|g|l|dl|cl|ml|kpl|st|x)?|kg|g|l|dl|cl|ml|kpl|st|x)$/

export type LineMatch = { id: string; sure: boolean }

// Letters OCR mixes up on receipt print: substituting one for the other is cheap.
const CONFUSABLE = ['co', 'c0', 'o0', 'il', 'i1', 'l1', 'sz', 's5', 'b8', 'g6', 'g9', 'aä', 'oö', 'hn', 'rn', 'nm', 'uv', 'ce', 'ec', 'kx', 'tf']
const cheap = new Set(CONFUSABLE.flatMap((p) => [p, p[1] + p[0]]))
/** Edit cost with OCR-confusable letters costing 0.3; gives up above `max`. */
function ocrDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return Infinity
  let prev = Array.from({ length: b.length + 1 }, (_, k) => k)
  for (let x = 1; x <= a.length; x++) {
    const cur = [x]
    let rowMin = x
    for (let y = 1; y <= b.length; y++) {
      const sub = a[x - 1] === b[y - 1] ? 0 : cheap.has(a[x - 1] + b[y - 1]) ? 0.3 : 1
      const v = Math.min(prev[y - 1] + sub, prev[y] + 1, cur[y - 1] + 1)
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return Infinity
    prev = cur
  }
  return prev[b.length]
}

// Receipt words that mean the same as catalogue words.
const SYNONYMS: Record<string, string[]> = { possun: ['porsaan'], possu: ['porsas', 'porsaan'], nauta: ['naudan'], kana: ['kanan'], broiler: ['broilerin'] }

type Indexed = { vocab: string[]; byWord: Map<string, number[]>; nameWords: string[][] }
const indexes = new WeakMap<Product[], Indexed>()
function indexOf(products: Product[]): Indexed {
  let ix = indexes.get(products)
  if (ix) return ix
  const byWord = new Map<string, number[]>()
  const nameWords: string[][] = []
  products.forEach((p, k) => {
    const nw = norm(`${p.name} ${p.altName ?? ''}`).split(' ').filter((w) => w.length >= 2 && !UNITS.test(w))
    nameWords.push(nw)
    for (const w of new Set([...nw, ...norm(p.brand ?? '').split(' ').filter((w) => w.length >= 2)])) {
      const list = byWord.get(w)
      if (list) list.push(k); else byWord.set(w, [k])
    }
  })
  ix = { vocab: [...byWord.keys()], byWord, nameWords }
  indexes.set(products, ix)
  return ix
}

/** How well a receipt word stands for a catalogue word (0 = not at all). */
function wordWeight(w: string, o: string): number {
  if (o === w) return 1
  if (w.length >= 3 && o.startsWith(w)) return 0.85 // receipt abbreviation: "RASV" → "rasvaton"
  if (o.length >= 4 && w.startsWith(o)) return 0.5 // compound on the receipt: "KANAFILEE" ⊃ "kana"
  if (w.length >= 4) {
    // misread letters: "PCSSUN" for "POSSUN", also in an abbreviation
    const max = w.length >= 7 ? 1.3 : 1
    if (ocrDistance(w, o, max) <= max) return 0.8
    if (o.length > w.length && ocrDistance(w, o.slice(0, w.length), max) <= max) return 0.7
  }
  return 0
}

/**
 * Link a receipt line to a catalogue product. Receipts abbreviate
 * ("VALIO RASV MAITO 1L") and photos get letters wrong ("PCSSUN"), so each
 * receipt word may be the start of a product word, or nearly it. Lines the
 * user linked before are recognised first.
 */
export function matchLine(name: string, products: Product[], learned: Record<string, string> = {}): LineMatch | undefined {
  const key = lineKey(name)
  const known = learned[key]
  if (known && products.some((p) => p.id === known)) return { id: known, sure: true }
  const words = norm(name).split(' ').filter((w) => w.length >= 2 && !UNITS.test(w))
  if (!words.length) return undefined
  const ix = indexOf(products)
  // per product: summed weight of the receipt words it explains, and which of its words were used
  const sums = new Map<number, { sum: number; hits: number; used: Set<string> }>()
  for (const w of words) {
    const best = new Map<number, { wt: number; via: string }>()
    const forms = [w, ...(SYNONYMS[w] ?? [])]
    for (const o of ix.vocab) {
      if (Math.abs(o.length - w.length) > 2 && !(o.length > w.length && o.startsWith(w.slice(0, 2))) && !(w.length > o.length && w.startsWith(o.slice(0, 2)))) continue
      let wt = 0
      for (const f of forms) wt = Math.max(wt, wordWeight(f, o))
      if (!wt) continue
      for (const k of ix.byWord.get(o)!) {
        const b = best.get(k)
        if (!b || wt > b.wt) best.set(k, { wt, via: o })
      }
    }
    for (const [k, { wt, via }] of best) {
      const s = sums.get(k) ?? { sum: 0, hits: 0, used: new Set<string>() }
      s.sum += wt; s.hits++; s.used.add(via)
      sums.set(k, s)
    }
  }
  let top: { id: string; rank: number; score: number; cover: number; hits: number } | undefined
  for (const [k, s] of sums) {
    const score = s.sum / words.length
    const nw = ix.nameWords[k]
    const cover = nw.length ? nw.filter((x) => s.used.has(x)).length / nw.length : 0
    const rank = score * 0.75 + cover * 0.25
    if (!top || rank > top.rank) top = { id: products[k].id, rank, score, cover, hits: s.hits }
  }
  if (!top) return undefined
  const enough = top.score >= 0.7 && (top.hits >= 2 || (words.length === 1 && words[0].length >= 5))
  if (!enough) return undefined
  return { id: top.id, sure: top.score >= 0.9 && top.cover >= 0.6 && top.hits >= 2 }
}

/** Older name kept for callers: the product id or undefined. */
export function matchProduct(name: string, products: Product[]): string | undefined {
  return matchLine(name, products)?.id
}

export function receiptObservations(receipts: Receipt[]): PriceObservation[] {
  const out: PriceObservation[] = []
  for (const r of receipts) {
    if (!r.retailerId) continue
    for (const it of r.items) {
      if (!it.productId || it.quantity < 1) continue
      out.push({
        productId: it.productId,
        retailerId: r.retailerId,
        priceCents: Math.round(it.priceCents / it.quantity),
        observedAt: r.date,
        source: 'user-report',
        origin: 'receipt',
      })
    }
  }
  return out
}

export function retailerName(r: Receipt, retailers: Retailer[]) {
  return retailers.find((x) => x.id === r.retailerId)?.name ?? (r.storeName || '—')
}

export interface MonthSavings {
  savedCents: number // paid less than the other shops' average
  missedCents: number // paid more than the cheapest other shop
  spentCents: number
  receipts: number
  compared: number // receipt lines that could be compared
}

/**
 * What this month's shopping saved: for every receipt line linked to a product,
 * the price paid is compared with the average price of the same product at the
 * other shops we have prices for (around the receipt date). Only real prices
 * from the shops are used, never the user's own receipts.
 */
export function monthSavings(receipts: Receipt[], pricesOf: (id: string) => PriceObservation[], now = new Date()): MonthSavings {
  const out: MonthSavings = { savedCents: 0, missedCents: 0, spentCents: 0, receipts: 0, compared: 0 }
  for (const r of receipts) {
    const d = new Date(r.date)
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue
    out.receipts++
    out.spentCents += r.totalCents ?? r.items.reduce((x, i) => x + i.priceCents, 0)
    const at = d.getTime()
    for (const it of r.items) {
      if (!it.productId || it.quantity < 1) continue
      const unit = it.priceCents / it.quantity
      // latest price per other shop, within 30 days of the receipt
      const latest = new Map<string, { t: number; c: number }>()
      for (const o of pricesOf(it.productId)) {
        if (o.source === 'user-report' || o.retailerId === r.retailerId) continue
        const t = Date.parse(o.observedAt)
        if (Math.abs(t - at) > 30 * 86_400_000) continue
        const prev = latest.get(o.retailerId)
        if (!prev || t > prev.t) latest.set(o.retailerId, { t, c: o.priceCents })
      }
      if (!latest.size) continue
      const prices = [...latest.values()].map((x) => x.c)
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length
      const min = Math.min(...prices)
      out.compared++
      if (unit < avg) out.savedCents += Math.round((avg - unit) * it.quantity)
      if (unit > min) out.missedCents += Math.round((unit - min) * it.quantity)
    }
  }
  return out
}
