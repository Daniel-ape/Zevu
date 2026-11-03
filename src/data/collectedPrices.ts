// Prices collected daily by collector/*.mjs and published with the app
// (public/prices/*.json). Each file lists prices by barcode for one store.

import type { PriceObservation, PriceProvider } from '../domain/types'
import { fetchData } from './dataFile'

interface File {
  retailerId: string
  fetchedAt: string
  prices: { ean: string; priceCents: number; checkedAt?: string }[]
}

export function collectedProvider(file: string, id: 'tokmanni'): PriceProvider {
  let data: Promise<File | null> | null = null
  let history: Promise<Record<string, [string, number][]>> | null = null
  return {
    id,
    label: file,
    isSample: false,
    async getObservations(): Promise<PriceObservation[]> {
      data ??= fetchData<File>(file)
      const d = await data
      if (!d) return []
      history ??= fetchData<Record<string, [string, number][]>>(file.replace('.json', '-history.json')).then((h) => h ?? {})
      // Earlier prices (one point per change), so history and price drops work.
      const past = Object.entries(await history).flatMap(([ean, points]) =>
        points
          .filter(([day]) => day < d.fetchedAt.slice(0, 10))
          .map(([day, cents]) => ({
            productId: `off:${ean}`, retailerId: d.retailerId, priceCents: cents,
            observedAt: `${day}T06:00:00.000Z`, source: id,
          })),
      )
      return [...past, ...d.prices.map((p) => ({
        productId: `off:${p.ean}`,
        retailerId: d.retailerId,
        priceCents: p.priceCents,
        // When this price was last checked on the store's site.
        observedAt: p.checkedAt ?? d.fetchedAt,
        source: id,
      }))]
    },
  }
}
