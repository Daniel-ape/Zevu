import type { Product } from './types'

// Finding a product by id in the full catalogue (over 200 000 products) one
// by one was done for every list row on every change, and added up to a
// noticeable pause on each tap. The index is built once per catalogue.
const cache = new WeakMap<readonly Product[], Map<string, Product>>()

export function productById(products: readonly Product[], id: string | undefined): Product | undefined {
  if (id == null) return undefined
  let m = cache.get(products)
  if (!m) {
    m = new Map()
    for (const p of products) if (!m.has(p.id)) m.set(p.id, p)
    cache.set(products, m)
  }
  return m.get(id)
}
