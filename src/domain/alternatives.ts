// Cheaper alternatives to a product: the same kind of thing from another brand,
// of a similar size, that costs clearly less per kilo, litre or piece.
// Pure functions, so the rules can be tested.
import type { Product } from './types'
import { nameWords } from './watch'
import { unitPrice } from './pricing'

/** The words of the name that say what the product is (brand words left out). */
export function kindWords(p: Pick<Product, 'name' | 'brand'>): string[] {
  const brand = new Set(nameWords(p.brand ?? ''))
  return nameWords(p.name).filter((w) => !brand.has(w))
}

const sameWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)))

export interface Alternative { product: Product; cents: number; unitCents: number; store: string; cheaperBy: number }

/**
 * Up to `max` products of the same category and kind (at least half of the
 * product's own words, at least one), from another brand, between half and
 * twice the size, at least 10 % cheaper per unit. Cheapest per unit first.
 */
export function cheaperAlternatives(
  product: Product,
  candidates: Product[],
  best: (p: Product) => { cents: number; store: string } | null,
  max = 3,
): Alternative[] {
  const own = best(product)
  if (!own || !product.size.amount) return []
  const ownUnit = unitPrice(product, own.cents)
  const mine = kindWords(product)
  if (ownUnit == null || !mine.length) return []
  const brand = (product.brand ?? '').trim().toLowerCase()
  const out: Alternative[] = []
  for (const c of candidates) {
    if (c.id === product.id || c.category !== product.category || c.size.unit !== product.size.unit || !c.size.amount) continue
    if (c.size.amount < product.size.amount / 2 || c.size.amount > product.size.amount * 2) continue
    if (brand && (c.brand ?? '').trim().toLowerCase() === brand) continue
    const theirs = kindWords(c)
    const shared = mine.filter((w) => theirs.some((x) => sameWord(w, x))).length
    if (!shared || shared / mine.length < 0.5) continue
    const b = best(c)
    if (!b) continue
    const u = unitPrice(c, b.cents)
    if (u == null || u > ownUnit * 0.9) continue
    out.push({ product: c, cents: b.cents, unitCents: u, store: b.store, cheaperBy: Math.round((1 - u / ownUnit) * 100) })
  }
  // one per name (the same product sold under two barcodes)
  const seen = new Set<string>()
  return out.sort((a, b) => a.unitCents - b.unitCents).filter((a) => { const k = a.product.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, max)
}
