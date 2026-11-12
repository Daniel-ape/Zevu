import { productById } from '../domain/productIndex'
import { useEffect, useMemo, useState } from 'react'
import { loadOffers, type LeafletOffer } from '../screens/Coupons'
import { offerIsFor } from '../domain/watch'
import type { Product } from '../domain/types'
import { useStore } from './store'
import { offerChainName } from './watchOffers'

/** A product on the shopping list that is cheaper than usual this week. */
export interface ListDeal {
  product: Product
  priceCents: number
  /** What it usually costs there (the shop's previous price, or the leaflet's normal price). */
  wasCents: number | null
  store: string
  /** From this week's leaflet (else: the shop's own price went down). */
  leaflet: boolean
}

const today = () => new Date().toISOString().slice(0, 10)

/**
 * The list's products that are on offer now: in a current leaflet, or with a
 * shop price at least 10 % below that shop's previous price in the last two weeks.
 * One deal per product, the cheapest.
 */
export function useListDeals(): ListDeal[] {
  const { list, products, pricesOf, retailers } = useStore()
  const [offers, setOffers] = useState<LeafletOffer[]>([])
  const any = list.items.length > 0
  useEffect(() => {
    if (!any) return
    let live = true
    loadOffers().then((d) => { if (live) setOffers(d?.offers ?? []) }).catch(() => {})
    return () => { live = false }
  }, [any])
  return useMemo(() => {
    const out: ListDeal[] = []
    const now = today()
    const valid = offers.filter((o) => (!o.validUntil || o.validUntil >= now) && (!o.validFrom || o.validFrom <= now))
    const name = (id: string) => retailers.find((r) => r.id === id)?.name ?? id
    const since = Date.now() - 14 * 86_400_000
    for (const item of list.items) {
      if (item.checked) continue
      const p = productById(products, item.productId)
      if (!p) continue
      const deals: ListDeal[] = []
      for (const o of valid) {
        if (!offerIsFor(p, o.name)) continue
        deals.push({ product: p, priceCents: o.priceCents, wasCents: o.regularCents, store: offerChainName(o.chain), leaflet: true })
      }
      // shop prices: newest vs the one before it, per shop
      const byShop = new Map<string, { at: number; cents: number }[]>()
      for (const ob of pricesOf(p.id)) {
        if (ob.source === 'user-report' || ob.source === 'sample') continue
        const a = byShop.get(ob.retailerId) ?? []
        a.push({ at: Date.parse(ob.observedAt), cents: ob.priceCents })
        byShop.set(ob.retailerId, a)
      }
      for (const [shop, pts] of byShop) {
        pts.sort((a, b) => b.at - a.at)
        const cur = pts[0]
        // the price before the current one (history repeats the current price on the day it changed)
        const prev = pts.find((x) => x.cents !== cur?.cents)
        if (!cur || !prev || cur.at < since) continue
        if (cur.cents <= prev.cents * 0.9) deals.push({ product: p, priceCents: cur.cents, wasCents: prev.cents, store: name(shop), leaflet: false })
      }
      if (deals.length) out.push(deals.sort((a, b) => a.priceCents - b.priceCents)[0])
    }
    // biggest saving first
    const off = (d: ListDeal) => (d.wasCents ? (d.wasCents - d.priceCents) / d.wasCents : 0)
    return out.sort((a, b) => off(b) - off(a))
  }, [offers, list.items, products, pricesOf, retailers])
}
