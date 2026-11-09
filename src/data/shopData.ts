// Prices the collectors gather from the shops' own sites, packed by
// scripts/build-price-bundles.ts:
//   core: everyday goods, catalogue products and anything sold by 2+ shops,
//         loaded when the app opens
//   rest: everything else, loaded the first time the user searches
import type { PriceObservation, PriceSource, Product } from '../domain/types'
import { EMOJI, categoryFor } from '../domain/categories'
import { fetchData } from './dataFile'
import { parseQuantity } from './openFoodFacts'

// [ean, priceCents, name, brand, image, path-or-url, checkedAt]
type Item = [string, number, string, string, string, string, string]
interface Bundle { builtAt: string; shops: { r: string; at: string; o: string; p?: string; i: Item[] }[] }
type History = Record<string, Record<string, [string, number][]>>

export interface ShopData { products: Product[]; observations: PriceObservation[]; images: [string, string][] }

export async function loadShopData(part: 'core' | 'rest'): Promise<ShopData> {
  const [bundle, history] = await Promise.all([
    fetchData<Bundle>(`app/${part}.json`),
    part === 'core' ? fetchData<History>('app/history.json') : Promise.resolve(null),
  ])
  const out: ShopData = { products: [], observations: [], images: [] }
  for (const s of bundle?.shops ?? []) {
    const source: PriceSource = s.r === 'tokmanni' ? 'tokmanni' : 'shop'
    for (const [ean, cents, name, brand, pic, link, checked] of s.i) {
      // pictures are stored without the start the shop's pictures share (s.p)
      const image = pic && !pic.startsWith('http') ? (s.p ?? '') + pic : pic
      const id = `off:${ean}`
      const url = link ? (link.startsWith('/') ? s.o + link : link) : undefined
      out.observations.push({ productId: id, retailerId: s.r, priceCents: cents, observedAt: checked.length === 16 ? checked + ':00.000Z' : checked, source, url })
      if (image) out.images.push([ean, image])
      if (name) {
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
        if (d < day) out.observations.push({ productId: `off:${ean}`, retailerId: s.r, priceCents: cents, observedAt: `${d}T06:00:00.000Z`, source })
      }
    }
  }
  return out
}
