// Bundled snapshot of real products sold in Finland, from Open Food Facts
// (ODbL licence). Lets search and barcode lookups work without a network
// connection, and inside sandboxes that block outside requests. Built by
// scripts/build-snapshot.ts. Product information only — never prices.

import type { CategoryId, Product } from '../domain/types'
import type { Lang } from '../i18n'
import { parseQuantity } from './openFoodFacts'
import { refineCategory } from '../domain/categories'
import { brandLabel } from '../domain/pricing'

// [ean, nameFi, nameSv, brand, quantity, category, emoji, imageChunk(-1 = none)]
type Row = [string, string, string, string, string, CategoryId, string, number]

let rows: Promise<Row[]> | null = null

export function loadSnapshot(): Promise<Row[]> {
  rows ??= fetch(new URL('products/fi.json', location.href).href)
    .then((r) => (r.ok ? r.json() : []))
    .then((d: { rows?: Row[] }) => d.rows ?? [])
    .catch(() => [])
  return rows
}

/**
 * A short catalogue name ("Original", "Natural", "Mozzarella") says little on
 * its own: show it with the brand ("Tuc Original") unless the brand is already
 * in the name.
 */
export function displayName(name: string, brand: string): string {
  const b = brandLabel(brand)
  // Parent companies aren't what people call the product ("Ferrero Nutella").
  if (/^(ferrero|mondelez|unilever|nestl[eé]|kraft|pepsico|coca-cola|mars|orkla|procter|kellogg|general mills|danone|lactalis|cloetta|valio oy|atria oyj)/i.test(b)) return name
  if (!b || name.split(/\s+/).length > 2 || name.toLowerCase().includes(b.toLowerCase().split(' ')[0])) return name
  return `${b} ${name}`
}

export function snapshotProducts(all: Row[], lang: Lang): Product[] {
  return all.map(([ean, fi, sv, brand, quantity, category, emoji, chunk]) => {
    const raw = (lang === 'sv' && sv) || fi || sv
    const name = displayName(raw, brand)
    // Size from the quantity field, or from the name when the field is empty ("Kit Kat 41,5 g").
    const q = parseQuantity(quantity)
    return {
      id: `off:${ean}`,
      ean,
      name,
      altName: lang === 'sv' && sv ? fi : sv || undefined,
      brand,
      category: refineCategory(raw, category),
      size: q.amount ? q : parseQuantity(raw),
      emoji,
      imageChunk: chunk >= 0 ? chunk : undefined,
      infoSource: 'open-food-facts' as const,
    }
  })
}

// Pictures are packed into a few files and loaded only when shown.
const chunks = new Map<number, Promise<Record<string, string>>>()
export function snapshotImage(chunk: number, ean: string): Promise<string | undefined> {
  if (!chunks.has(chunk)) {
    chunks.set(
      chunk,
      fetch(new URL(`products/img-${chunk}.json`, location.href).href)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
    )
  }
  return chunks.get(chunk)!.then((m) => m[ean])
}
