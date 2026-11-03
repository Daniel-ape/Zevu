import type { PriceObservation, Product, Retailer, ShoppingList } from './types'

/** Prices older than this are shown as outdated and excluded from "cheapest". */
export const STALE_AFTER_DAYS = 7

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
  return ageDays(o.observedAt, now) > STALE_AFTER_DAYS ? 'outdated' : 'fresh'
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
      const product = products.find((p) => p.id === item.productId)
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
      const product = products.find((p) => p.id === item.productId)
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
      if (last && end - last.t <= 14 * DAY && last.cents < low) low = last.cents
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
