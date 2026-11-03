import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { basketTotals, cheapest, compare, euro, sizeLabel, trend } from '../domain/pricing'
import { useNav } from '../nav'
import { ArrowRight, List, Receipt } from '../ui/icons'
import { Tile, TrendTag } from '../ui/bits'
import { ReceiptSheet } from './ReceiptSheet'
import { Cover, useShelf } from './Leaflets'
import type { Key } from '../i18n'

function greeting(): Key {
  const h = new Date().getHours()
  return h < 5 ? 'home.night' : h < 11 ? 'home.morning' : h < 17 ? 'home.day' : h < 22 ? 'home.evening' : 'home.night'
}

export function Home() {
  const { products, observations, retailers, list, recent, loading, watched, lang, pricesOf, t } = useStore()
  const nav = useNav()
  const [receipt, setReceipt] = useState(false)
  const { shelf } = useShelf()
  const listName = list.name === 'Weekly shop' ? t('list.defaultName') : list.name
  const itemCount = list.items.reduce((n, i) => n + i.quantity, 0)

  const totals = useMemo(
    () => basketTotals(list, products, observations, retailers),
    [list, products, observations, retailers],
  )
  const best = totals.find((x) => x.missing === 0)
  const worst = [...totals].filter((x) => x.missing === 0).sort((a, b) => b.totalCents - a.totalCents)[0]
  const saving = best && worst ? worst.totalCents - best.totalCents : 0

  const drops = useMemo(
    () =>
      products
        .filter((p) => pricesOf(p.id).length > 4)
        .map((p) => ({ p, pct: trend(p, pricesOf(p.id)) }))
        .filter((d): d is { p: typeof d.p; pct: number } => d.pct !== null && d.pct < -1)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 4),
    [products, pricesOf],
  )

  // Products that have a current price, the most popular first (the catalogue
  // is ordered by popularity), skipping the ones already listed as drops.
  const priced = useMemo(() => {
    const dropped = new Set(drops.map((d) => d.p.id))
    return products
      .filter((p) => pricesOf(p.id).length > 0 && !dropped.has(p.id))
      .map((p) => ({ p, c: cheapest(compare(p, pricesOf(p.id), retailers)) }))
      .filter((x) => x.c)
      .slice(0, 12)
  }, [products, pricesOf, retailers, drops])

  const leaflets = shelf.flatMap((c) => c.leaflets.map((l) => ({ chain: c.chain, l })))
    .sort((a, b) => (a.l.status === 'now' ? 0 : 1) - (b.l.status === 'now' ? 0 : 1))
    .slice(0, 8)

  const today = new Date().toLocaleDateString(lang === 'sv' ? 'sv-FI' : lang === 'fi' ? 'fi-FI' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const noOwnPrices = !loading && !observations.some((o) => o.source === 'user-report')

  return (
    <div className="screen home">
      <div className="home-head">
        <div className="eyebrow">{today}</div>
        <h1>{t(greeting())}</h1>
      </div>

      {list.items.length > 0 && (
        <button className="list-card section" style={{ marginTop: 18 }} onClick={() => nav.go('lists')}>
          <span className="quick-icon"><List size={22} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{listName} · {itemCount === 1 ? t('list.items1') : t('list.items', { n: itemCount })}</b>
            <span className="sub">
              {best ? t('home.cheapestStore', { store: best.retailer.name }) + (saving > 0 ? ' · ' + t('home.saveUpTo', { amount: euro(saving) }) : '') : t('home.noListPrices')}
            </span>
          </span>
          {best ? <span className="price">{euro(best.totalCents)}</span> : <ArrowRight size={16} />}
        </button>
      )}

      {leaflets.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('home.leaflets')}</h2>
            <button className="link small" onClick={() => nav.go('leaflets')}>{t('home.seeAll')} <ArrowRight size={14} /></button>
          </div>
          <div className="strip covers-strip">
            {leaflets.map(({ chain, l }) => <Cover key={l.url} chain={chain} l={l} compact />)}
          </div>
        </div>
      )}

      {drops.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('home.drops')}</h2>
            <span className="muted tiny">{t('home.last4w')}</span>
          </div>
          <div className="rows">
            {drops.map(({ p, pct }) => {
              const c = cheapest(compare(p, pricesOf(p.id), retailers))
              return (
                <button key={p.id} className="row" onClick={() => nav.openProduct(p.id)}>
                  <Tile product={p} />
                  <div className="grow">
                    <div className="title">{p.name}</div>
                    <div className="sub">{[sizeLabel(p), c?.retailer.name].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="end">
                    {c && <div className="price">{euro(c.current.priceCents)}</div>}
                    <TrendTag pct={pct} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {watched.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>{t('watch.title')}</h2></div>
          <div className="rows">
            {watched.map((w) => {
              const p = products.find((x) => x.id === w.productId)
              if (!p) return null
              const c = cheapest(compare(p, pricesOf(p.id), retailers))
              const now = c?.current.priceCents ?? null
              const diff = now !== null && w.baselineCents !== null ? now - w.baselineCents : null
              return (
                <button key={w.productId} className="row" onClick={() => nav.openProduct(p.id)}>
                  <Tile product={p} />
                  <div className="grow">
                    <div className="title">{p.name}</div>
                    <div className="sub">{c ? c.retailer.name : t('watch.noPrice')}</div>
                  </div>
                  <div className="end">
                    {now !== null && <div className="price">{euro(now)}</div>}
                    {diff !== null && (
                      <div className="tiny" style={{ fontWeight: 600, color: diff < 0 ? 'var(--good)' : diff > 0 ? 'var(--warn)' : 'var(--text-2)' }}>
                        {diff < 0 ? t('watch.cheaper', { amount: euro(-diff) }) : diff > 0 ? t('watch.dearer', { amount: euro(diff) }) : t('watch.same')}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {priced.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('home.prices')}</h2>
            <button className="link small" onClick={() => nav.go('search')}>{t('home.seeAll')} <ArrowRight size={14} /></button>
          </div>
          <div className="rows">
            {priced.slice(0, 6).map(({ p, c }) => (
              <button key={p.id} className="row" onClick={() => nav.openProduct(p.id)}>
                <Tile product={p} />
                <div className="grow">
                  <div className="title">{p.name}</div>
                  <div className="sub">{[sizeLabel(p), c!.retailer.name].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="end"><div className="price">{euro(c!.current.priceCents)}</div></div>
              </button>
            ))}
          </div>
        </div>
      )}

      {noOwnPrices && (
        <button className="tip section" onClick={() => setReceipt(true)}>
          <span className="quick-icon"><Receipt size={22} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{t('home.startTitle')}</b>
            <span>{t('home.startShort')}</span>
          </span>
          <ArrowRight size={16} />
        </button>
      )}

      {recent.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>{t('home.recent')}</h2></div>
          <div className="strip">
            {recent.map((id) => {
              const p = products.find((x) => x.id === id)
              if (!p) return null
              return (
                <button key={id} className="price-card" onClick={() => nav.openProduct(id)}>
                  <Tile product={p} />
                  <div className="price-card-name">{p.name}</div>
                  <div className="price-card-size">{sizeLabel(p)}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {receipt && <ReceiptSheet onClose={() => setReceipt(false)} />}
    </div>
  )
}
