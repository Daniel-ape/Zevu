import { productById } from './productIndex'
import type { PriceObservation, Product, Retailer, ShoppingList } from './types'

/**
 * Prices older than this are shown as outdated and excluded from "cheapest".
 * The collectors re-read every product page in rotation (a full round takes
 * one to four weeks), so shop prices count for longer than a receipt or a
 * shelf label the user scanned, which only says what one store charged that day.
 */
export const STALE_AFTER_DAYS = 35
export const STALE_OWN_AFTER_DAYS = 14

export type Freshness = 'fresh' | 'outdated'

export interface RetailerPrice {
  retailer: Retailer
  current: PriceObservation
  previous?: PriceObservation
  freshness: Freshness
  unitPriceCents: number | null
}

export function ageDays(iso: string, now = Date.now()): number {
  return (now - new Date(iso).getTime()) / 86_400_000
}

export function freshnessOf(o: PriceObservation, now = Date.now()): Freshness {
  const limit = o.source === 'user-report' ? STALE_OWN_AFTER_DAYS : STALE_AFTER_DAYS
  return ageDays(o.observedAt, now) > limit ? 'outdated' : 'fresh'
}

/** Price per kg, per litre or per piece, in cents. */
export function unitPrice(p: Product, cents: number): number | null {
  const { amount, unit } = p.size
  if (!amount) return null
  if (unit === 'pcs') return Math.round(cents / amount)
  return Math.round((cents / amount) * 1000)
}

export function unitLabel(p: Product): string {
  return p.size.unit === 'g' ? '/kg' : p.size.unit === 'ml' ? '/l' : '/pc'
}

export function sizeLabel(p: Product): string {
  const { amount, unit } = p.size
  if (!amount) return ''
  if (unit === 'pcs') return amount === 1 ? '1 pc' : `${amount} pcs`
  if (amount >= 1000) return `${(amount / 1000).toLocaleString('fi-FI')} ${unit === 'g' ? 'kg' : 'l'}`
  return `${amount} ${unit}`
}

export const euro = (cents: number) =>
  (cents / 100).toLocaleString('fi-FI', { style: 'currency', currency: 'EUR' })

/** Latest observation per retailer for one product, cheapest fresh price first. */
export function compare(
  product: Product,
  observations: PriceObservation[],
  retailers: Retailer[],
  now = Date.now(),
): RetailerPrice[] {
  const rows: RetailerPrice[] = []
  for (const retailer of retailers) {
    const mine = observations
      .filter((o) => o.productId === product.id && o.retailerId === retailer.id)
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    if (!mine.length) continue
    rows.push({
      retailer,
      current: mine[0],
      previous: mine[1],
      freshness: freshnessOf(mine[0], now),
      unitPriceCents: unitPrice(product, mine[0].priceCents),
    })
  }
  return rows.sort((a, b) => {
    if (a.freshness !== b.freshness) return a.freshness === 'fresh' ? -1 : 1
    return a.current.priceCents - b.current.priceCents
  })
}

export function cheapest(rows: RetailerPrice[]): RetailerPrice | undefined {
  return rows.find((r) => r.freshness === 'fresh')
}

/** Weekly lowest fresh-at-the-time price across retailers, oldest first. */
export function lowestHistory(product: Product, observations: PriceObservation[], now = Date.now()) {
  const weeks = new Map<number, number>()
  for (const o of observations) {
    if (o.productId !== product.id) continue
    const wk = Math.floor(ageDays(o.observedAt, now) / 7)
    const prev = weeks.get(wk)
    if (prev === undefined || o.priceCents < prev) weeks.set(wk, o.priceCents)
  }
  return [...weeks.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([wk, cents]) => ({ date: new Date(now - wk * 7 * 86_400_000), cents }))
}

/** Percent change of the cheapest price over roughly the last four weeks. */
export function trend(product: Product, observations: PriceObservation[], now = Date.now()): number | null {
  const h = lowestHistory(product, observations, now)
  if (h.length < 5) return null
  const last = h[h.length - 1].cents
  const before = h[h.length - 5].cents
  return ((last - before) / before) * 100
}

export interface BasketTotal {
  retailer: Retailer
  totalCents: number
  missing: number // items this retailer has no fresh price for
}

/** Total cost of a list at each retailer. Missing items are counted, never guessed. */
export function basketTotals(
  list: ShoppingList,
  products: Product[],
  observations: PriceObservation[],
  retailers: Retailer[],
  now = Date.now(),
): BasketTotal[] {
  const totals = retailers.map((retailer) => {
    let totalCents = 0
    let missing = 0
    for (const item of list.items) {
      const product = productById(products, item.productId)
      if (!product) continue
      const row = compare(product, observations, [retailer], now)[0]
      if (!row || row.freshness !== 'fresh') missing++
      else totalCents += row.current.priceCents * item.quantity
    }
    return { retailer, totalCents, missing }
  })
  // Complete baskets first, then by price.
  return totals.sort((a, b) => a.missing - b.missing || a.totalCents - b.totalCents)
}

export interface SplitPlan {
  /** One or two stores, in the order they cover most of the list. */
  stores: Retailer[]
  totalCents: number
  /** Which store each priced item is bought at. */
  picks: { productId: string; quantity: number; retailer: Retailer; priceCents: number }[]
  /** Items no store has a fresh price for (left out of the totals). */
  unpriced: number
  /** The best one-store basket for the same items, if one store has them all. */
  single?: { retailer: Retailer; totalCents: number }
  savingCents: number
}

/**
 * Cheapest way to buy the list in at most two stores. Items without a price
 * anywhere are left out (never guessed). Returns null unless splitting beats
 * buying everything in one store.
 */
export function splitPlan(
  list: ShoppingList,
  products: Product[],
  pricesOf: (id: string) => PriceObservation[],
  retailers: Retailer[],
  now = Date.now(),
): SplitPlan | null {
  const items = list.items
    .map((item) => {
      const product = productById(products, item.productId)
      if (!product) return null
      const prices = new Map<string, number>()
      for (const r of compare(product, pricesOf(product.id), retailers, now)) if (r.freshness === 'fresh') prices.set(r.retailer.id, r.current.priceCents)
      return { item, prices }
    })
    .filter((x): x is { item: ShoppingList['items'][number]; prices: Map<string, number> } => !!x)
  const priced = items.filter((x) => x.prices.size > 0)
  if (priced.length < 2) return null
  const unpriced = items.length - priced.length

  const cost = (ids: string[]) => {
    let total = 0
    let covered = 0
    for (const { item, prices } of priced) {
      const best = Math.min(...ids.map((id) => prices.get(id) ?? Infinity))
      if (best !== Infinity) { total += best * item.quantity; covered++ }
    }
    return { total, covered }
  }
  const stores = retailers.filter((r) => priced.some((x) => x.prices.has(r.id)))
  let single: { retailer: Retailer; totalCents: number } | undefined
  for (const r of stores) {
    const c = cost([r.id])
    if (c.covered === priced.length && (!single || c.total < single.totalCents)) single = { retailer: r, totalCents: c.total }
  }
  let best: { ids: [string, string]; total: number; covered: number } | undefined
  for (let i = 0; i < stores.length; i++) {
    for (let j = i + 1; j < stores.length; j++) {
      const ids: [string, string] = [stores[i].id, stores[j].id]
      const c = cost(ids)
      if (!best || c.covered > best.covered || (c.covered === best.covered && c.total < best.total)) best = { ids, ...c }
    }
  }
  if (!best || best.covered < priced.length) return null
  if (single && best.total >= single.totalCents) return null

  const picks = priced.map(({ item, prices }) => {
    const id = best!.ids.reduce((a, b) => ((prices.get(a) ?? Infinity) <= (prices.get(b) ?? Infinity) ? a : b))
    return { productId: item.productId, quantity: item.quantity, retailer: retailers.find((r) => r.id === id)!, priceCents: prices.get(id)! }
  })
  const used = best.ids.map((id) => retailers.find((r) => r.id === id)!).filter((r) => picks.some((p) => p.retailer.id === r.id))
  if (used.length < 2) return null
  used.sort((a, b) => picks.filter((p) => p.retailer.id === b.id).length - picks.filter((p) => p.retailer.id === a.id).length)
  return { stores: used, totalCents: best.total, picks, unpriced, single, savingCents: single ? single.totalCents - best.total : 0 }
}

/**
 * Lowest price per day across retailers, as it would have looked on each day:
 * every retailer keeps its last known price until it changes, and prices older
 * than two weeks on that day are left out. Covers up to `days` back from the
 * first observation, oldest first.
 */
export function dailyLowest(productId: string, observations: PriceObservation[], now = Date.now(), days = 90) {
  const DAY = 86_400_000
  const byRetailer = new Map<string, { t: number; cents: number }[]>()
  for (const o of observations) {
    if (o.productId !== productId) continue
    const t = Date.parse(o.observedAt)
    if (!Number.isFinite(t)) continue
    const arr = byRetailer.get(o.retailerId) ?? []
    arr.push({ t, cents: o.priceCents })
    byRetailer.set(o.retailerId, arr)
  }
  if (!byRetailer.size) return []
  for (const arr of byRetailer.values()) arr.sort((a, b) => a.t - b.t)
  const first = Math.min(...[...byRetailer.values()].map((a) => a[0].t))
  const today = Math.floor(now / DAY)
  const start = Math.max(Math.floor(first / DAY), today - days)
  const out: { date: Date; cents: number }[] = []
  for (let d = start; d <= today; d++) {
    const end = (d + 1) * DAY
    let low = Infinity
    for (const arr of byRetailer.values()) {
      let last: { t: number; cents: number } | undefined
      for (const p of arr) { if (p.t < end) last = p; else break }
      if (last && end - last.t <= STALE_AFTER_DAYS * DAY && last.cents < low) low = last.cents
    }
    if (low < Infinity) out.push({ date: new Date(d * DAY + DAY / 2), cents: low })
  }
  return out
}

/** Facts about the price curve: lowest, highest, and how today compares. */
export function priceFacts(points: { date: Date; cents: number }[]) {
  if (!points.length) return null
  const now = points[points.length - 1].cents
  const vals = points.map((p) => p.cents)
  const min = Math.min(...vals), max = Math.max(...vals)
  // Price just before the latest change, if it was higher.
  let i = points.length - 1
  while (i > 0 && points[i - 1].cents === now) i--
  const before = i > 0 ? points[i - 1].cents : null
  return {
    now, min, max,
    since: points[0].date,
    days: points.length,
    lowest: max > min && now === min,
    droppedFrom: before !== null && before > now ? before : null,
    changedAt: i > 0 ? points[i].date : null,
  }
}

/**
 * Brand for display: the catalogue often has the supplier's registered name
 * ("LANTMANNEN CEREALIA AS", "Viennetta - Unilever"). Keep the first brand,
 * drop company forms and write all-caps names in normal case.
 */
export function brandLabel(brand: string): string {
  let b = (brand ?? '').split(/,| - /)[0].trim()
  b = b.replace(/\s*\((?:nordic|finland|suomi)\)\s*$/i, '').replace(/\s+(?:oy|oyj|ab|as|a\/s|asa|ltd|gmbh|inc|s\.?a\.?|aps|oy ab|ab oy|norge as|sverige ab|finland oy|nordic)\.?$/i, '').trim()
  b = b.replace(/\s+(?:oy|ab|as|norge|norway|sverige|sweden|danmark|denmark|nordic|finland|suomi)$/i, '').trim()
  if (b.length > 3 && b === b.toUpperCase() && /[A-ZÅÄÖ]/.test(b)) b = b.toLowerCase().replace(/(^|[\s\-&/])([a-zåäöü])/g, (_, s, c) => s + c.toUpperCase())
  return b
}

export interface PriceGap { product: Product; low: RetailerPrice; high: RetailerPrice; saveCents: number; pct: number }
export interface ShopRank { retailer: Retailer; cheapest: number; compared: number }

/**
 * From products sold by at least two shops (fresh prices only):
 * - gaps: where choosing the right shop saves the most (biggest % difference)
 * - ranking: how often each shop is the cheapest of the shops that sell it
 */
export function storeInsights(
  products: Product[],
  pricesOf: (id: string) => PriceObservation[],
  retailers: Retailer[],
  now = Date.now(),
): { gaps: PriceGap[]; ranking: ShopRank[]; compared: number } {
  const gaps: PriceGap[] = []
  const rank = new Map<string, ShopRank>()
  let compared = 0
  for (const p of products) {
    const obs = pricesOf(p.id)
    if (obs.length < 2 || new Set(obs.map((o) => o.retailerId)).size < 2) continue
    const fresh = compare(p, obs, retailers, now).filter((r) => r.freshness === 'fresh')
    if (fresh.length < 2) continue
    compared++
    const low = fresh[0], high = fresh[fresh.length - 1]
    for (const r of fresh) {
      const x = rank.get(r.retailer.id) ?? { retailer: r.retailer, cheapest: 0, compared: 0 }
      x.compared++
      if (r.current.priceCents === low.current.priceCents) x.cheapest++
      rank.set(r.retailer.id, x)
    }
    const saveCents = high.current.priceCents - low.current.priceCents
    const pct = saveCents / high.current.priceCents
    // Over ~60 % apart is almost always a pack-size mix-up (one shop prices a single piece), so skip it.
    if (saveCents >= 50 && pct >= 0.1 && pct <= 0.6 && high.current.priceCents <= 30000) gaps.push({ product: p, low, high, saveCents, pct })
  }
  // Everyday goods (food, drugstore, cleaning, pets) first: that is what people shop for weekly.
  const everyday = new Set(['dairy', 'bread', 'produce', 'meat', 'pantry', 'drinks', 'snacks', 'household', 'health', 'pets'])
  gaps.sort((a, b) => (everyday.has(b.product.category) ? 1 : 0) - (everyday.has(a.product.category) ? 1 : 0) || b.pct - a.pct || b.saveCents - a.saveCents)
  const seen = new Set<string>()
  // One product name once, and at most three gaps per pair of shops so the list stays varied.
  const pairs = new Map<string, number>()
  const uniq = gaps.filter((g) => {
    const k = g.product.name.toLowerCase().replace(/\d+([.,]\d+)?\s*(cm|mm|m|g|kg|ml|l|kpl|x)\b/g, '').replace(/\s+/g, ' ').slice(0, 24)
    const pair = g.low.retailer.id + '>' + g.high.retailer.id
    if (seen.has(k) || (pairs.get(pair) ?? 0) >= 3) return false
    seen.add(k); pairs.set(pair, (pairs.get(pair) ?? 0) + 1)
    return true
  })
  const ranking = [...rank.values()].filter((r) => r.compared >= 10).sort((a, b) => b.cheapest / b.compared - a.cheapest / a.compared)
  return { gaps: uniq, ranking, compared }
}

export interface StoreSeries { retailer: Retailer; values: (number | null)[] }

/**
 * Daily price per shop (each shop's last known price carried forward, left
 * out once it is more than two weeks old), over the same days as dailyLowest.
 */
export function dailyByStore(productId: string, observations: PriceObservation[], retailers: Retailer[], now = Date.now(), days = 90) {
  const DAY = 86_400_000
  const by = new Map<string, { t: number; cents: number }[]>()
  for (const o of observations) {
    if (o.productId !== productId) continue
    const t = Date.parse(o.observedAt)
    if (!Number.isFinite(t)) continue
    const arr = by.get(o.retailerId) ?? []
    arr.push({ t, cents: o.priceCents })
    by.set(o.retailerId, arr)
  }
  if (!by.size) return { dates: [] as Date[], series: [] as StoreSeries[] }
  for (const a of by.values()) a.sort((x, y) => x.t - y.t)
  const today = Math.floor(now / DAY)
  const first = Math.min(...[...by.values()].map((a) => a[0].t))
  const start = Math.max(Math.floor(first / DAY), today - days)
  const dates: Date[] = []
  for (let d = start; d <= today; d++) dates.push(new Date(d * DAY + DAY / 2))
  const series: StoreSeries[] = []
  for (const [id, arr] of by) {
    const retailer = retailers.find((r) => r.id === id)
    if (!retailer) continue
    const values = dates.map((_, k) => {
      const end = (start + k + 1) * DAY
      let last: { t: number; cents: number } | undefined
      for (const p of arr) { if (p.t < end) last = p; else break }
      return last && end - last.t <= STALE_AFTER_DAYS * DAY ? last.cents : null
    })
    if (values.some((v) => v !== null)) series.push({ retailer, values })
  }
  // cheapest today first
  series.sort((a, b) => (a.values[a.values.length - 1] ?? Infinity) - (b.values[b.values.length - 1] ?? Infinity))
  return { dates, series }
}
