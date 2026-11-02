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
