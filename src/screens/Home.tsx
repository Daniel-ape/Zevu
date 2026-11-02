import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { basketTotals, cheapest, compare, euro, sizeLabel, trend } from '../domain/pricing'
import { useNav } from '../nav'
import { Tile, TrendTag } from '../ui/bits'
import { Offers } from '../ui/Offers'
import { ReceiptSheet } from './ReceiptSheet'

export function Home() {
  const { products, observations, retailers, list, recent, loading, watched, t } = useStore()
  const nav = useNav()
  const [receipt, setReceipt] = useState(false)
  const listName = list.name === 'Weekly shop' ? t('list.defaultName') : list.name

  const totals = useMemo(
    () => basketTotals(list, products, observations, retailers),
    [list, products, observations, retailers],
  )
  const best = totals.find((t) => t.missing === 0) ?? totals[0]
  const worst = [...totals].filter((t) => t.missing === 0).sort((a, b) => b.totalCents - a.totalCents)[0]
  const saving = best && worst ? worst.totalCents - best.totalCents : 0

  const drops = useMemo(
    () =>
      products
        .map((p) => ({ p, pct: trend(p, observations) }))
        .filter((d): d is { p: typeof d.p; pct: number } => d.pct !== null && d.pct < -1)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 4),
    [products, observations],
  )

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Hintaopas</h1>
      </div>

      <div>
        {!loading && best && list.items.length > 0 && (
          <button className="hero" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.go('lists')}>
            <div style={{ position: 'relative' }}>
              <div className="small" style={{ opacity: 0.75, fontWeight: 600 }}>{t('home.cheapestAt', { list: listName })}</div>
              <div className="hero-big">{best.retailer.name}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <span className="pill">{euro(best.totalCents)}</span>
                {saving > 0 && <span className="pill">{t('home.saveUpTo', { amount: euro(saving) })}</span>}
              </div>
            </div>
          </button>
        )}
      </div>

      {drops.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('home.drops')}</h2>
            <span className="muted tiny">{t('home.last4w')}</span>
          </div>
          <div>
            <div className="rows">
              {drops.map(({ p, pct }) => {
                const c = cheapest(compare(p, observations, retailers))
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
        </div>
      )}

      {!loading && !observations.some((o) => o.source === 'user-report') && (
        <div className="notice-plain section">
          <div className="title" style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{t('home.startTitle')}</div>
          <div className="small muted" style={{ lineHeight: 1.5 }}>{t('home.startText')}</div>
          <button className="btn primary" style={{ marginTop: 14, height: 48 }} onClick={() => setReceipt(true)}>{t('home.startBtn')}</button>
        </div>
      )}

      {receipt && <ReceiptSheet onClose={() => setReceipt(false)} />}

      {watched.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>{t('watch.title')}</h2></div>
          <div className="rows">
            {watched.map((w) => {
              const p = products.find((x) => x.id === w.productId)
              if (!p) return null
              const c = cheapest(compare(p, observations, retailers))
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

      <Offers />

      {recent.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('home.recent')}</h2>
          </div>
          <div className="chips">
            {recent.map((id) => {
              const p = products.find((x) => x.id === id)
              if (!p) return null
              return (
                <button key={id} style={{ minWidth: 112, textAlign: 'left' }} onClick={() => nav.openProduct(id)}>
                  <Tile product={p} />
                  <div className="small" style={{ fontWeight: 600, marginTop: 10, lineHeight: 1.3 }}>{p.name}</div>
                  <div className="tiny muted" style={{ marginTop: 2 }}>{sizeLabel(p)}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
