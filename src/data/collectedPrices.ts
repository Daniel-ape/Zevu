// Prices collected daily by collector/*.mjs and published with the app
// (public/prices/*.json). Each file lists prices by barcode for one store.

import type { PriceObservation, PriceProvider } from '../domain/types'

interface File {
  retailerId: string
  fetchedAt: string
  prices: { ean: string; priceCents: number }[]
}

export function collectedProvider(file: string, id: 'tokmanni'): PriceProvider {
  let data: Promise<File | null> | null = null
  let history: Promise<Record<string, [string, number][]>> | null = null
  return {
    id,
    label: file,
    isSample: false,
    async getObservations(): Promise<PriceObservation[]> {
      data ??= fetch(new URL(`prices/${file}`, location.href).href)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      const d = await data
      if (!d) return []
      history ??= fetch(new URL(`prices/${file.replace('.json', '-history.json')}`, location.href).href)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}))
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
        observedAt: d.fetchedAt,
        source: id,
      }))]
    },
  }
}
