import { useEffect, useMemo } from 'react'
import { useStore } from '../data/store'
import { cheapest, compare, euro, lowestHistory, sizeLabel, trend, unitLabel } from '../domain/pricing'
import { useNav } from '../nav'
import { Back, Check, Plus } from '../ui/icons'
import { PriceMeta, RankBadge, RetailerMark, SampleNotice, Tile, TrendTag } from '../ui/bits'
import { PriceChart } from '../ui/PriceChart'
import { inAppLink } from '../data/openLink'

export function ProductScreen({ id }: { id: string }) {
  const { products, observations, retailers, list, setQuantity, markViewed, t } = useStore()
  const nav = useNav()
  const product = products.find((p) => p.id === id)

  useEffect(() => markViewed(id), [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (product ? compare(product, observations, retailers) : []), [product, observations, retailers])
  const history = useMemo(() => (product ? lowestHistory(product, observations) : []), [product, observations])
  if (!product) return <div className="screen empty">{t('product.notFound')}</div>

  const best = cheapest(rows)
  const fresh = rows.filter((r) => r.freshness === 'fresh')
  const spread = best && fresh.length > 1 ? fresh[fresh.length - 1].current.priceCents - best.current.priceCents : 0
  const inList = list.items.find((i) => i.productId === product.id)

  return (
    <div className="screen push">
      <div className="topbar center sticky">
        <button className="icon-btn" onClick={nav.back} aria-label={t('product.back')}><Back /></button>
        <span style={{ flex: 1 }} />
        <span style={{ width: 42 }} aria-hidden />
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Tile product={product} large />
        <div style={{ minWidth: 0 }}>
          <div className="muted small">{product.brand}</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 2 }}>{product.name}</div>
          <div className="muted small" style={{ marginTop: 4 }}>{sizeLabel(product)}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="notice-plain section">
          <div className="title" style={{ fontWeight: 600, marginBottom: 6 }}>{t('product.noPricesYet')}</div>
          <div className="small muted" style={{ lineHeight: 1.5 }}>{t('product.noPricesHint')}</div>
        </div>
      ) : (
        <>
      <div className="stats section" style={{ marginTop: 20 }}>
        <div className="stat">
          <div className="label">{t('product.lowest')}</div>
          <div className="value">{best ? euro(best.current.priceCents) : '—'}</div>
        </div>
        <div className="stat">
          <div className="label">{t('product.per', { unit: unitLabel(product).slice(1) })}</div>
          <div className="value">{best?.unitPriceCents != null ? euro(best.unitPriceCents) : '—'}</div>
        </div>
        <div className="stat">
          <div className="label">{t('product.save')}</div>
          <div className="value" style={{ color: spread > 0 ? 'var(--good)' : undefined }}>{spread > 0 ? euro(spread) : '—'}</div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>{t('product.byStore')}</h2>
          <SampleNotice compact />
        </div>
        <div className="rows">
          {rows.map((r) => {
            const rank = r.freshness === 'fresh' ? fresh.indexOf(r) + 1 : 0
            return (
              <div key={r.retailer.id} className="row" style={{ opacity: r.freshness === 'outdated' ? 0.6 : 1 }}>
                {rank ? <RankBadge rank={rank} /> : <div className="rank">–</div>}
                <RetailerMark retailer={r.retailer} />
                <div className="grow">
                  <div className="title">{r.retailer.name}</div>
                  <div className="sub"><PriceMeta row={r} /></div>
                </div>
                <div className="end">
                  <div className="price" style={{ color: rank === 1 ? 'var(--accent)' : undefined }}>{euro(r.current.priceCents)}</div>
                  <div className="sub">{r.unitPriceCents != null ? `${euro(r.unitPriceCents)}${unitLabel(product)}` : ''}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>{t('product.history')}</h2>
          <TrendTag pct={trend(product, observations)} />
        </div>
        <PriceChart points={history} />
      </div>

        </>
      )}

      {product.infoSource === 'open-food-facts' && (
        <p className="tiny muted" style={{ marginTop: 18 }}>
          <a href={`https://world.openfoodfacts.org/product/${product.ean}`} target="_blank" rel="noreferrer" onClick={inAppLink(`https://world.openfoodfacts.org/product/${product.ean}`)} style={{ color: 'inherit' }}>{t('product.info')}</a>
        </p>
      )}

      <div className="section">
        {inList ? (
          <button className="btn ghost" onClick={() => nav.go('lists')}>
            <Check /> {t('product.inList', { n: inList.quantity })}
          </button>
        ) : (
          <button className="btn primary" onClick={() => setQuantity(product.id, 1)}>
            <Plus /> {t('product.add')}
          </button>
        )}
      </div>
    </div>
  )
}
