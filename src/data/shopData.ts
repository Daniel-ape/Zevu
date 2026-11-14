// Prices the collectors gather from the shops' own sites, packed by
// scripts/build-price-bundles.ts:
//   core: everyday goods, catalogue products and anything sold by 2+ shops,
//         loaded when the app opens
//   rest: everything else, loaded the first time the user searches
import type { PriceObservation, PriceSource, Product } from '../domain/types'
import { EMOJI, categoryFor } from '../domain/categories'
import { fetchData } from './dataFile'
import { parseQuantity } from './openFoodFacts'

// [ean, priceCents, name, brand, image, path-or-url, checkedAt, 1 = in the shops only?]
type Item = [string, number, string, string, string, string, string, 1?]
interface Bundle { builtAt: string; shops: { r: string; at: string; o: string; p?: string; i: Item[] }[] }
type History = Record<string, Record<string, [string, number][]>>

export interface ShopData { products: Product[]; observations: PriceObservation[]; images: [string, string][] }

export async function loadShopData(part: 'core' | 'rest'): Promise<ShopData> {
  const [bundle, history] = await Promise.all([
    fetchData<Bundle>(`app/${part}.json`),
    part === 'core' ? fetchData<History>('app/history.json') : Promise.resolve(null),
  ])
  const out: ShopData = { products: [], observations: [], images: [] }
  // Memory matters on phones (the system closes an app that uses too much):
  // one product per barcode even when several shops sell it, and each
  // check time stored once and shared.
  const seen = new Set<string>()
  const times = new Map<string, string>()
  const ids = new Map<string, string>()
  const idOf = (ean: string) => { let v = ids.get(ean); if (v === undefined) { v = `off:${ean}`; ids.set(ean, v) } return v }
  const time = (t: string) => { let v = times.get(t); if (v === undefined) { v = t.length === 16 ? t + ':00.000Z' : t; times.set(t, v) } return v }
  // The work is done a few thousand products at a time, with a short pause
  // in between, so the app keeps answering taps while the catalogue loads
  // (on a slow phone, doing it all at once froze the screen for seconds).
  let done = 0
  const pause = () => new Promise<void>((r) => setTimeout(r, 0))
  for (const s of bundle?.shops ?? []) {
    const source: PriceSource = s.r === 'tokmanni' ? 'tokmanni' : 'shop'
    for (const [ean, cents, name, brand, pic, link, checked, storeOnly] of s.i) {
      if (++done % 2500 === 0) await pause()
      // pictures are stored without the start the shop's pictures share (s.p)
      const image = pic && !pic.startsWith('http') ? (s.p ?? '') + pic : pic
      const id = idOf(ean)
      const url = link ? (link.startsWith('/') ? s.o + link : link) : undefined
      out.observations.push({ productId: id, retailerId: s.r, priceCents: cents, observedAt: time(checked), source, url, ...(storeOnly ? { inStoreOnly: true } : {}) })
      if (image) out.images.push([ean, image])
      if (name && !seen.has(ean)) {
        seen.add(ean)
        const category = categoryFor(name, s.r)
        out.products.push({
          id, ean, name, brand, category, emoji: EMOJI[category],
          // Shops rarely give the size separately, but it is usually in the name ("400 g", "6 x 0,33 l").
          size: parseQuantity(name), imageUrl: image || undefined,
        })
      }
    }
    // Earlier prices (one point per change), so history and price drops work.
    const day = s.at.slice(0, 10)
    for (const [ean, points] of Object.entries(history?.[s.r] ?? {})) {
      for (const [d, cents] of points) {
        if (d < day) out.observations.push({ productId: idOf(ean), retailerId: s.r, priceCents: cents, observedAt: time(`${d}T06:00`), source })
      }
    }
  }
  return out
}
