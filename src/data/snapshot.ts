// Bundled snapshot of real products sold in Finland, from Open Food Facts
// (ODbL licence). Lets search and barcode lookups work without a network
// connection, and inside sandboxes that block outside requests. Built by
// scripts/build-snapshot.ts. Product information only — never prices.

import type { CategoryId, Product } from '../domain/types'
import type { Lang } from '../i18n'
import { parseQuantity } from './openFoodFacts'
import { refineCategory } from '../domain/categories'

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

export function snapshotProducts(all: Row[], lang: Lang): Product[] {
  return all.map(([ean, fi, sv, brand, quantity, category, emoji, chunk]) => ({
    id: `off:${ean}`,
    ean,
    name: (lang === 'sv' && sv) || fi || sv,
    altName: lang === 'sv' && sv ? fi : sv || undefined,
    brand,
    category: refineCategory((lang === 'sv' && sv) || fi || sv, category),
    size: parseQuantity(quantity),
    emoji,
    imageChunk: chunk >= 0 ? chunk : undefined,
    infoSource: 'open-food-facts' as const,
  }))
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
