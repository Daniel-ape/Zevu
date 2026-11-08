import { useState } from 'react'
import { useStore } from '../data/store'
import { offerChainName, useWatchOffers } from '../data/watchOffers'
import { cheapest, compare, euro } from '../domain/pricing'
import type { Watch } from '../domain/types'
import { useNav } from '../nav'
import { OfferSheet, type LeafletOffer } from '../screens/Coupons'
import { Tile } from './bits'
import { Sheet } from './Sheet'

/** Round down to a shop-like price (…,99 / …,49 / …,x9). */
const shopPrice = (c: number) => Math.max(9, Math.floor((c - 9) / 10) * 10 + 9)

/** The watched products: price now, change since watched, the price waited for and leaflet offers. */
export function WatchList() {
  const { watched, products, pricesOf, retailers, t } = useStore()
  const offers = useWatchOffers()
  const [open, setOpen] = useState<string | null>(null)
  if (!watched.length) return <div className="empty">{t('you.noWatched')}</div>
  const w = watched.find((x) => x.productId === open)
  return (
    <>
      <p className="group-note" style={{ marginTop: 0 }}>{t('watch.how')}</p>
      <div className="rows">
        {watched.map((w) => {
          const p = products.find((x) => x.id === w.productId)
          if (!p) return null
          const c = cheapest(compare(p, pricesOf(p.id), retailers))
          const now = c?.current.priceCents ?? null
          const diff = now !== null && w.baselineCents !== null ? now - w.baselineCents : null
          const offer = offers.get(p.id)?.[0]
          return (
            <button key={w.productId} className="row watch-row" onClick={() => setOpen(p.id)}>
              <Tile product={p} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="title">{p.name}</div>
                <div className="sub">{c ? c.retailer.name : t('watch.noPrice')}</div>
                <div className="watch-tags">
                  {w.targetCents != null && <span className="wtag">{t('watch.target', { price: euro(w.targetCents) })}</span>}
                  {offer && <span className="wtag offer">{t('watch.offerTag', { chain: offerChainName(offer.chain), price: euro(offer.priceCents) })}</span>}
                </div>
              </div>
              <div className="end">
                {now !== null && <div className="price">{euro(now)}</div>}
                {diff !== null && diff !== 0 && (
                  <div className="tiny" style={{ fontWeight: 600, color: diff < 0 ? 'var(--good)' : 'var(--warn)' }}>
                    {diff < 0 ? `−${euro(-diff)}` : `+${euro(diff)}`}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      {w && <WatchSheet w={w} offers={offers.get(w.productId) ?? []} onClose={() => setOpen(null)} />}
    </>
  )
}

function WatchSheet({ w, offers, onClose }: { w: Watch; offers: LeafletOffer[]; onClose: () => void }) {
  const { products, pricesOf, retailers, setWatchTarget, toggleWatch, t } = useStore()
  const nav = useNav()
  const [offer, setOffer] = useState<LeafletOffer | null>(null)
  const [own, setOwn] = useState('')
  const p = products.find((x) => x.id === w.productId)
  if (!p) return null
  const c = cheapest(compare(p, pricesOf(p.id), retailers))
  const now = c?.current.priceCents ?? w.baselineCents
  const choices = now ? [10, 20, 30].map((pct) => ({ pct, cents: shopPrice(Math.round(now * (1 - pct / 100))) })) : []
  const setOwnPrice = () => {
    const cents = Math.round(parseFloat(own.replace(',', '.').replace(/[^\d.]/g, '')) * 100)
    if (cents > 0) { setWatchTarget(p.id, cents); setOwn('') }
  }
  return (
    <Sheet title={p.name} onClose={onClose} closeLabel={t('common.close')}>
      <div className="watch-now">
        <Tile product={p} />
        <div>
          <div className="price" style={{ fontSize: 22 }}>{c ? euro(c.current.priceCents) : t('watch.noPrice')}</div>
          <div className="sub">
            {c?.retailer.name}
            {w.baselineCents != null && <> · {t('watch.since', { price: euro(w.baselineCents) })}</>}
          </div>
        </div>
      </div>

      <div className="group-title" style={{ margin: '18px 4px 8px' }}>{t('watch.tellWhen')}</div>
      <div className="chips wrap">
        <button className={'chip' + (w.targetCents == null ? ' on' : '')} onClick={() => setWatchTarget(p.id, null)}>{t('watch.anyDrop')}</button>
        {choices.map((ch) => (
          <button key={ch.pct} className={'chip' + (w.targetCents === ch.cents ? ' on' : '')} onClick={() => setWatchTarget(p.id, ch.cents)}>
            {t('watch.under', { price: euro(ch.cents) })}
          </button>
        ))}
        {w.targetCents != null && !choices.some((ch) => ch.cents === w.targetCents) && (
          <button className="chip on">{t('watch.under', { price: euro(w.targetCents) })}</button>
        )}
      </div>
      <form className="watch-own" onSubmit={(e) => { e.preventDefault(); setOwnPrice() }}>
        <input inputMode="decimal" value={own} onChange={(e) => setOwn(e.target.value)} placeholder={t('watch.ownPrice')} />
        <button className="btn" type="submit" disabled={!own.trim()}>{t('watch.set')}</button>
      </form>

      {offers.length > 0 && (
        <>
          <div className="group-title" style={{ margin: '18px 4px 8px' }}>{t('watch.leaflets')}</div>
          <div className="rows">
            {offers.map((o) => (
              <button key={`${o.chain}${o.priceCents}${o.name}`} className="row" onClick={() => setOffer(o)}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="title">{o.name}</div>
                  <div className="sub">{offerChainName(o.chain)}{o.member ? ` · ${t('watch.member')}` : ''}</div>
                </div>
                <div className="end">
                  <div className="price" style={{ color: 'var(--accent)' }}>{euro(o.priceCents)}</div>
                  {o.percent ? <div className="tiny muted">−{o.percent} %</div> : null}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'grid', gap: 8, marginTop: 20 }}>
        <button className="btn primary" onClick={() => { onClose(); nav.openProduct(p.id) }}>{t('watch.open')}</button>
        <button className="btn danger-text" onClick={() => { toggleWatch(p.id, null); onClose() }}>{t('watch.stop')}</button>
      </div>
      {offer && <OfferSheet o={offer} onClose={() => setOffer(null)} />}
    </Sheet>
  )
}
