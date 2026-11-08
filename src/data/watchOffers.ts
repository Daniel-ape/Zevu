import { useEffect, useMemo, useState } from 'react'
import { loadOffers, type LeafletOffer } from '../screens/Coupons'
import { offerIsFor } from '../domain/watch'
import { useStore } from './store'

const today = () => new Date().toISOString().slice(0, 10)

/** This week's leaflet offers on the watched products, by product id. */
export function useWatchOffers(): Map<string, LeafletOffer[]> {
  const { watched, products } = useStore()
  const [offers, setOffers] = useState<LeafletOffer[]>([])
  const any = watched.length > 0
  useEffect(() => {
    if (!any) return
    let live = true
    loadOffers().then((d) => { if (live) setOffers(d?.offers ?? []) }).catch(() => {})
    return () => { live = false }
  }, [any])
  return useMemo(() => {
    const out = new Map<string, LeafletOffer[]>()
    if (!offers.length) return out
    const now = today()
    const valid = offers.filter((o) => !o.validUntil || o.validUntil >= now)
    for (const w of watched) {
      const p = products.find((x) => x.id === w.productId)
      if (!p) continue
      const hits = valid.filter((o) => offerIsFor(p, o.name))
      // one per chain and price: leaflets repeat the same offer on several pages
      const seen = new Set<string>()
      const unique = hits.filter((o) => { const k = `${o.chain}:${o.priceCents}`; if (seen.has(k)) return false; seen.add(k); return true })
      if (unique.length) out.set(p.id, unique.sort((a, b) => a.priceCents - b.priceCents))
    }
    return out
  }, [offers, watched, products])
}

export const offerKey = (productId: string, o: LeafletOffer) => `${productId}|${o.chain}|${o.name}|${o.priceCents}|${o.validUntil ?? ''}`

const CHAIN_NAMES: Record<string, string> = {
  lidl: 'Lidl', tokmanni: 'Tokmanni', minimani: 'Minimani', rusta: 'Rusta', halpahalli: 'Halpa-Halli', karkkainen: 'Kärkkäinen', k: 'K-Ruoka', s: 'S-ryhmä',
}
export const offerChainName = (chain: string) => CHAIN_NAMES[chain] ?? chain.charAt(0).toUpperCase() + chain.slice(1)
