// Weekly store leaflets shown inside the app.
// A leaflet is a list of pages; a page is either a picture of the printed
// page (as leaflet services deliver them) or a set of offers the app lays out
// itself. Real leaflets need a licensed source (a leaflet service such as
// Tjek, or the retailer); until then only a clearly labelled sample exists.

import type { ChainId } from './types'

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
