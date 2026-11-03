// Prices collected daily by collector/*.mjs and published with the app
// (public/prices/*.json). Each file lists prices by barcode for one store.

import type { CategoryId, PriceObservation, PriceProvider, PriceSource, Product } from '../domain/types'
import { fetchData } from './dataFile'

interface File {
  retailerId: string
  fetchedAt: string
  prices: { ean: string; priceCents: number; checkedAt?: string; name?: string; brand?: string; image?: string }[]
}

const files = new Map<string, Promise<File | null>>()
const load = (file: string) => {
  if (!files.has(file)) files.set(file, fetchData<File>(file))
  return files.get(file)!
}

// Simple category guess from a Finnish/Swedish product name.
const GUESS: [RegExp, CategoryId][] = [
  [/maito|juusto|jogurtti|kerma|voi\b|rahka|viili|muna|mjölk|ost\b/i, 'dairy'],
  [/leipä|sämpylä|näkki|korppu|bröd/i, 'bread'],
  [/liha|makkara|nakki|kinkku|kana|broiler|kala|lohi|kött|korv/i, 'meat'],
  [/omena|banaani|peruna|tomaatti|kurkku|porkkana|hedelmä|vihannes|marja|frukt/i, 'produce'],
  [/juoma|mehu|kahvi|tee\b|vesi|limsa|olut|kaffe|dryck/i, 'drinks'],
  [/suklaa|karkki|makeinen|sipsi|keksi|choklad|godis|chips/i, 'snacks'],
  [/pasta|makaroni|riisi|jauho|kastike|säilyke|mauste|öljy|hiutale|mysli|muro/i, 'pantry'],
]
const EMOJI: Record<CategoryId, string> = { dairy: '🥛', produce: '🥕', bread: '🍞', meat: '🥩', pantry: '🥫', drinks: '🧃', snacks: '🍫', household: '🛍️' }

/** Products a shop sells that aren't in the catalogue, built from the shop's own data. */
export async function collectedProducts(file: string): Promise<Product[]> {
  const d = await load(file)
  if (!d) return []
  return d.prices.filter((p) => p.name).map((p) => {
    const category = GUESS.find(([re]) => re.test(p.name!))?.[1] ?? 'household'
    return {
      id: `off:${p.ean}`, ean: p.ean, name: p.name!, brand: p.brand ?? '', category,
      size: { amount: 0, unit: 'pcs' as const }, emoji: EMOJI[category],
      imageUrl: p.image && /^https:\/\//.test(p.image) ? p.image : undefined,
    }
  })
}

export function collectedProvider(file: string, id: string): PriceProvider {
  const source: PriceSource = id === 'tokmanni' ? 'tokmanni' : 'shop'
  let data: Promise<File | null> | null = null
  let history: Promise<Record<string, [string, number][]>> | null = null
  return {
    id: source,
    label: file,
    isSample: false,
    async getObservations(): Promise<PriceObservation[]> {
      data ??= load(file)
      const d = await data
      if (!d) return []
      history ??= fetchData<Record<string, [string, number][]>>(file.replace('.json', '-history.json')).then((h) => h ?? {})
      // Earlier prices (one point per change), so history and price drops work.
      const past = Object.entries(await history).flatMap(([ean, points]) =>
        points
          .filter(([day]) => day < d.fetchedAt.slice(0, 10))
          .map(([day, cents]) => ({
            productId: `off:${ean}`, retailerId: d.retailerId, priceCents: cents,
            observedAt: `${day}T06:00:00.000Z`, source,
          })),
      )
      return [...past, ...d.prices.map((p) => ({
        productId: `off:${p.ean}`,
        retailerId: d.retailerId,
        priceCents: p.priceCents,
        // When this price was last checked on the store's site.
        observedAt: p.checkedAt ?? d.fetchedAt,
        source,
      }))]
    },
  }
}
