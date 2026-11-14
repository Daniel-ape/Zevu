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

const pause = () => new Promise<void>((r) => setTimeout(r, 0))

/** Build the index in small pieces, so a slow phone never freezes while it is
 * made. Done once, in the background, soon after the catalogue loads. */
export async function warmProductIndex(products: readonly Product[], stop: () => boolean = () => false) {
  if (cache.has(products)) return
  const m = new Map<string, Product>()
  for (let i = 0; i < products.length; i += 8000) {
    const end = Math.min(products.length, i + 8000)
    for (let k = i; k < end; k++) { const p = products[k]; if (!m.has(p.id)) m.set(p.id, p) }
    await pause()
    if (stop() || cache.has(products)) return
  }
  cache.set(products, m)
}
