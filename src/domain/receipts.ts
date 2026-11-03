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
]

// Lines that are never products.
const SKIP = /(yhteens|summa|\btotal|\balv\b|\bvero\b|kortti|k[aä]teinen|vaihtoraha|takaisin|maksettu|\bvisa\b|mastercard|debit|credit|bonus|pisteet|kuitti|y-tunnus|\bpuh\b|\bkassa\b|\bnetto\b|brutto|veroton|verollinen|\bmoms\b|att betala|\bkort\b|kontant|tilinumero|arkistointi|\bviite|kiitos|tervetuloa|\bpantti\b|\bpant\b)/i
const TOTAL = /(yhteens[aä]|summa|total|att betala|maksettava)/i
const DISCOUNT = /(alennus|etu\b|tarjous|rabatt|plussa|kampanja|s[aä][aä]st[oö]|lidl plus|-\d+\s?%)/i
// Deposit refunds are money back, not a discount on the item above.
const REFUND = /(palautus|pantti|\bpant\b|returglas|pullonpalautus)/i
const PRICE_AT_END = /(-?\d{1,4}[,.]\d{2})(-?)\s*(€|eur)?\s*[A-D]?\s*$/i
const QTY_LINE = /^\s*(\d+)\s*(kpl|st|x)\s*[x*]?\s*(\d+[,.]\d{2})/i
const WEIGHT_LINE = /^\s*\d+[,.]\d+\s*kg\b/i
const DATE = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/

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
  for (const line of lines) {
    if (TOTAL.test(line)) {
      const p = line.match(PRICE_AT_END)
      if (p) totalCents = priceOf(p)
      break // everything after the total is payment info
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
    const name = line.slice(0, p.index).trim()
    const value = priceOf(p)
    if (REFUND.test(name)) continue
    // Discounts: negative amounts, or a discount word printed with a plain amount ("ALENNUS 0,30").
    if (value < 0 || (DISCOUNT.test(name) && items.length && name.split(' ').length <= 3)) {
      if (items.length) items[items.length - 1].priceCents -= Math.abs(value)
      continue
    }
    if (!name || name.length < 2 || SKIP.test(name) || /^\d+$/.test(name)) continue
    items.push({ name, quantity: 1, priceCents: value })
  }

  return { retailerId, storeName, date: date.toISOString(), items, totalCents }
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim()
}

/** Key under which a receipt line's link to a product is remembered. */
export const lineKey = (name: string) => norm(name).replace(/\b\d+([.,]\d+)?\s?(kg|g|l|dl|cl|ml|kpl|pcs|st)\b/g, '').replace(/\s+/g, ' ').trim()

const UNITS = /^(\d+([.,]\d+)?(kg|g|l|dl|cl|ml|kpl|st|x)?|kg|g|l|dl|cl|ml|kpl|st|x)$/

export type LineMatch = { id: string; sure: boolean }

/**
 * Link a receipt line to a catalogue product. Receipts abbreviate
 * ("VALIO RASV MAITO 1L"), so each receipt word may be the start of a product
 * word. Lines the user linked before are recognised first.
 */
export function matchLine(name: string, products: Product[], learned: Record<string, string> = {}): LineMatch | undefined {
  const key = lineKey(name)
  const known = learned[key]
  if (known && products.some((p) => p.id === known)) return { id: known, sure: true }
  const words = norm(name).split(' ').filter((w) => w.length >= 2 && !UNITS.test(w))
  if (!words.length) return undefined
  let best: { id: string; rank: number; score: number; cover: number; hits: number } | undefined
  for (const p of products) {
    const nameWords = norm(`${p.name} ${p.altName ?? ''}`).split(' ').filter((w) => w.length >= 2 && !UNITS.test(w))
    const own = [...nameWords, ...norm(p.brand).split(' ').filter((w) => w.length >= 2)]
    // exact word 1, receipt abbreviation of a product word 0.85, a shorter
    // product word inside a longer receipt word 0.5
    let sum = 0
    let hits = 0
    const used = new Set<string>()
    for (const w of words) {
      let wt = 0
      let via = ''
      for (const o of own) {
        const v = o === w ? 1 : w.length >= 3 && o.startsWith(w) ? 0.85 : o.length >= 4 && w.startsWith(o) ? 0.5 : 0
        if (v > wt) { wt = v; via = o }
      }
      if (wt) { sum += wt; hits++; used.add(via) }
    }
    if (!hits) continue
    const score = sum / words.length
    // how much of the product's own name the line covers
    const cover = nameWords.length ? nameWords.filter((w) => used.has(w)).length / nameWords.length : 0
    const rank = score * 0.75 + cover * 0.25
    if (!best || rank > best.rank) best = { id: p.id, rank, score, cover, hits }
  }
  if (!best) return undefined
  const enough = best.score >= 0.75 && (best.hits >= 2 || (words.length === 1 && words[0].length >= 5))
  if (!enough) return undefined
  return { id: best.id, sure: best.score >= 0.9 && best.cover >= 0.6 && best.hits >= 2 }
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
