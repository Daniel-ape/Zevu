// Weekly store leaflets shown inside the app.
// A leaflet is a list of pages; a page is either a picture of the printed
// page (as leaflet services deliver them) or a set of offers the app lays out
// itself. Real leaflets need a licensed source (a leaflet service such as
// Tjek, or the retailer); until then only a clearly labelled sample exists.

import type { ChainId, PriceObservation, Product } from './types'

export interface LeafletOffer {
  productId: string
  title: string
  priceCents: number
  normalCents?: number
  limit?: string
}

export interface LeafletPage {
  imageUrl?: string
  heading?: string
  offers?: LeafletOffer[]
}

export interface Leaflet {
  id: string
  chain: ChainId | null
  title: string
  validFrom: string
  validTo: string
  pages: LeafletPage[]
  source: 'sample' | 'licensed'
}

/** Monday–Sunday of the current week. */
export function currentWeek(now = new Date()) {
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - ((from.getDay() + 6) % 7))
  const to = new Date(from)
  to.setDate(to.getDate() + 6)
  return { from, to }
}

/** A sample leaflet built from the sample catalogue, so the viewer can be tried. */
export function sampleLeaflet(products: Product[], observations: PriceObservation[], headings: string[]): Leaflet {
  const { from, to } = currentWeek()
  const picks = ['p12', 'p10', 'p1', 'p17', 'p7', 'p9', 'p5', 'p3', 'p13', 'p15', 'p14', 'p16']
  const offers: LeafletOffer[] = picks.flatMap((id) => {
    const p = products.find((x) => x.id === id)
    const prices = observations.filter((o) => o.productId === id).map((o) => o.priceCents)
    if (!p || !prices.length) return []
    const normal = Math.max(...prices)
    const offer = Math.max(49, Math.round((normal * 0.72) / 10) * 10 - 1)
    return [{ productId: id, title: p.name, priceCents: offer, normalCents: normal, limit: id === 'p12' ? '2' : undefined }]
  })
  const pages: LeafletPage[] = []
  for (let i = 0; i < offers.length; i += 4) pages.push({ heading: headings[pages.length % headings.length], offers: offers.slice(i, i + 4) })
  return { id: 'sample', chain: null, title: '', validFrom: from.toISOString(), validTo: to.toISOString(), pages, source: 'sample' }
}
