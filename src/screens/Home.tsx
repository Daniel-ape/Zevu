import { useMemo } from 'react'
import { useStore } from '../data/store'
import { basketTotals, cheapest, compare, euro, sizeLabel, trend } from '../domain/pricing'
import { useNav } from '../nav'
import { SampleNotice, Tile, TrendTag } from '../ui/bits'
import { Offers } from '../ui/Offers'

export function Home() {
  const { products, observations, retailers, list, recent, loading, t } = useStore()
  const nav = useNav()
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
        <SampleNotice compact />
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
                      <div className="sub">{sizeLabel(p)}{c ? ` · ${c.retailer.name}` : ''}</div>
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
