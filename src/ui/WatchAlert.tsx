import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { cheapest, compare, euro } from '../domain/pricing'
import { useNav } from '../nav'
import { Tile } from './bits'

// In the web app (and on iPhone, where it runs from the home screen) there is
// no background work, so price drops on watched products are shown here when
// the app is opened: a banner that opens the product. Each drop is shown once.
const KEY = 'hintaopas:alerted'
const readSeen = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} } }

export function WatchAlert() {
  const { watched, products, pricesOf, retailers, loading, t } = useStore()
  const nav = useNav()
  const [seen, setSeen] = useState(readSeen)
  const drop = useMemo(() => {
    if (loading) return null
    for (const w of watched) {
      const p = products.find((x) => x.id === w.productId)
      if (!p) continue
      const c = cheapest(compare(p, pricesOf(p.id), retailers))
      if (!c) continue
      const ref = seen[w.productId] ?? w.baselineCents
      if (ref != null && c.current.priceCents < ref) return { p, c, ref }
    }
    return null
  }, [loading, watched, products, pricesOf, retailers, seen])
  if (!drop) return null
  const done = () => {
    const next = { ...seen, [drop.p.id]: drop.c.current.priceCents }
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
    setSeen(next)
  }
  return (
    <div className="watch-alert glass" role="status">
      <button className="wa-body" onClick={() => { done(); nav.openProduct(drop.p.id) }}>
        <Tile product={drop.p} />
        <div className="grow">
          <div className="wa-eyebrow">{t('watch.cheaper', { amount: euro(drop.ref - drop.c.current.priceCents) })}</div>
          <div className="wa-title">{drop.p.name}</div>
          <div className="wa-sub"><b>{euro(drop.c.current.priceCents)}</b> · {drop.c.retailer.name}</div>
        </div>
      </button>
      <button className="wa-close" onClick={done} aria-label="OK">✕</button>
    </div>
  )
}
