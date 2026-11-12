import { productById } from '../domain/productIndex'
import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { offerChainName, offerKey, useWatchOffers } from '../data/watchOffers'
import { cheapest, compare, euro } from '../domain/pricing'
import { watchHit } from '../domain/watch'
import { useNav } from '../nav'
import { Tile } from './bits'

// Shown on the home page when the app is opened: a watched product got cheaper
// (or reached the price the user waits for), or is in a leaflet this week.
// Each one is shown once; the installed app also sends a notification
// (public/runners/background.js).
const KEY = 'hintaopas:alerted'
const OFFERS_KEY = 'hintaopas:alertedOffers'
const read = <T,>(k: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') ?? fallback } catch { return fallback } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

export function WatchAlert() {
  const { watched, products, pricesOf, retailers, loading, t } = useStore()
  const nav = useNav()
  const offers = useWatchOffers()
  const [seen, setSeen] = useState<Record<string, number>>(() => read(KEY, {}))
  const [seenOffers, setSeenOffers] = useState<string[]>(() => read(OFFERS_KEY, []))
  const alert = useMemo(() => {
    if (loading) return null
    for (const w of watched) {
      const p = productById(products, w.productId)
      if (!p) continue
      const c = cheapest(compare(p, pricesOf(p.id), retailers))
      const now = c?.current.priceCents
      if (c && now != null && watchHit(now, w, seen[w.productId])) {
        const ref = seen[w.productId] ?? w.baselineCents ?? now
        return {
          kind: 'price' as const, p,
          eyebrow: w.targetCents != null && now <= w.targetCents ? t('watch.reached', { price: euro(w.targetCents) }) : t('watch.cheaper', { amount: euro(ref - now) }),
          line: <><b>{euro(now)}</b> · {c.retailer.name}</>,
          done: () => { const next = { ...seen, [p.id]: now }; write(KEY, next); setSeen(next) },
        }
      }
    }
    for (const w of watched) {
      const p = productById(products, w.productId)
      const o = p && offers.get(p.id)?.find((x) => !seenOffers.includes(offerKey(p.id, x)))
      if (!p || !o) continue
      return {
        kind: 'offer' as const, p,
        eyebrow: t('watch.inLeaflet', { chain: offerChainName(o.chain) }),
        line: <><b>{euro(o.priceCents)}</b>{o.percent ? ` · −${o.percent} %` : ''}{o.member ? ` · ${t('watch.member')}` : ''}</>,
        done: () => { const next = [...seenOffers, offerKey(p.id, o)].slice(-200); write(OFFERS_KEY, next); setSeenOffers(next) },
      }
    }
    return null
  }, [loading, watched, products, pricesOf, retailers, seen, offers, seenOffers, t])
  if (!alert) return null
  return (
    <div className="watch-alert glass" role="status">
      <button className="wa-body" onClick={() => { alert.done(); nav.openProduct(alert.p.id) }}>
        <Tile product={alert.p} />
        <div className="grow">
          <div className={'wa-eyebrow' + (alert.kind === 'offer' ? ' offer' : '')}>{alert.eyebrow}</div>
          <div className="wa-title">{alert.p.name}</div>
          <div className="wa-sub">{alert.line}</div>
        </div>
      </button>
      <button className="wa-close" onClick={alert.done} aria-label="OK">✕</button>
    </div>
  )
}
