// Shrinkflation: a product that comes in a smaller pack while the price per
// kilo or litre goes up. The sizes the shops print in their product names are
// recorded every day (scripts/record-sizes.ts, kept in public/prices/sizes.json),
// and a shrink is found in two ways:
//   - the same barcode is now sold in a smaller size, or
//   - a product disappeared and soon after one with the same brand and name,
//     only a smaller size, appeared under a new barcode (pack-size changes
//     should get a new barcode, and usually do).
import { parseQuantity } from '../data/openFoodFacts'

/** One size the product was seen in: [first day, amount, unit, lowest price in cents]. */
export type SizePoint = [string, number, string, number]
export interface SizeEntry {
  /** name without the size, lower case, for finding the same product under a new barcode */
  n: string
  b: string
  /** first day seen, and the day it stopped being sold (absent while sold) */
  f: string
  g?: string
  z: SizePoint[]
}
export interface SizeDb { since: string; items: Record<string, SizeEntry> }

/** [new barcode, old barcode, old amount, new amount, unit, day, old cents, new cents] */
export type Shrink = [string, string, number, number, string, string, number, number]

const SIZE_RE = /\b\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:kg|g|l|dl|cl|ml)\b|\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|grams?|l|dl|cl|ml|kpl|pcs|st)\b/gi

export function nameStem(name: string): string {
  return name.toLowerCase().replace(SIZE_RE, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export function sizeOf(name: string): { amount: number; unit: string } | null {
  const s = parseQuantity(name)
  if (!s.amount || (s.unit === 'pcs' && s.amount < 2)) return null
  return s
}

/** Adds today's sizes; prices: every shop's [barcode, name, brand, cents]. */
export function updateSizes(db: SizeDb, prices: Iterable<[string, string, string, number]>, today: string): SizeDb {
  const low = new Map<string, [string, string, number]>()
  for (const [ean, name, brand, cents] of prices) {
    if (!name || !sizeOf(name)) continue
    const p = low.get(ean)
    if (!p || cents < p[2]) low.set(ean, [name, brand, cents])
  }
  for (const [ean, [name, brand, cents]] of low) {
    const s = sizeOf(name)!
    const e = db.items[ean] ?? (db.items[ean] = { n: nameStem(name), b: brand.toLowerCase().trim(), f: today, z: [] })
    delete e.g
    if (brand && !e.b) e.b = brand.toLowerCase().trim()
    const last = e.z[e.z.length - 1]
    if (last && last[1] === s.amount && last[2] === s.unit) last[3] = cents
    else e.z.push([today, s.amount, s.unit, cents])
  }
  // only changes are written, so the file stays small in git
  for (const [ean, e] of Object.entries(db.items)) if (!low.has(ean) && !e.g) e.g = today
  return db
}

const DAY = 86_400_000
const unitPrice = (cents: number, amount: number) => cents / amount

export function findShrinks(db: SizeDb, today: string): Shrink[] {
  const out: Shrink[] = []
  const shrank = (oldAmt: number, oldC: number, newAmt: number, newC: number) =>
    newAmt < oldAmt * 0.97 && unitPrice(newC, newAmt) > unitPrice(oldC, oldAmt) * 1.02
  // same barcode, smaller pack
  for (const [ean, e] of Object.entries(db.items)) {
    for (let i = 1; i < e.z.length; i++) {
      const a = e.z[i - 1], b = e.z[i]
      if (a[2] === b[2] && shrank(a[1], a[3], b[1], b[3])) out.push([ean, ean, a[1], b[1], b[2], b[0], a[3], b[3]])
    }
  }
  // new barcode taking an old one's place (only once a week of sizes is known,
  // so the first day's whole range doesn't count as "new")
  const settled = Date.parse(db.since) + 7 * DAY
  const gone = new Map<string, [string, SizeEntry][]>()
  for (const [ean, e] of Object.entries(db.items)) {
    if (!e.b || e.n.length < 4 || !e.g) continue
    const k = `${e.b}|${e.n}`
    gone.set(k, [...(gone.get(k) ?? []), [ean, e]])
  }
  for (const [ean, e] of Object.entries(db.items)) {
    if (Date.parse(e.f) <= settled || !e.b) continue
    const now = e.z[e.z.length - 1]
    for (const [oldEan, o] of gone.get(`${e.b}|${e.n}`) ?? []) {
      const was = o.z[o.z.length - 1]
      const gap = Date.parse(e.f) - Date.parse(o.g!)
      if (oldEan === ean || was[2] !== now[2] || gap < -14 * DAY || gap > 60 * DAY) continue
      if (shrank(was[1], was[3], now[1], now[3])) { out.push([ean, oldEan, was[1], now[1], now[2], e.f, was[3], now[3]]); break }
    }
  }
  // keep a year
  const cutoff = new Date(Date.parse(today) - 365 * DAY).toISOString().slice(0, 10)
  return out.filter((s) => s[5] >= cutoff)
}
