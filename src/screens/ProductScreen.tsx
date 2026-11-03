import { useEffect, useMemo } from 'react'
import { useStore } from '../data/store'
import { cheapest, compare, dailyLowest, euro, priceFacts, sizeLabel, trend, unitLabel } from '../domain/pricing'
import { LOCALE } from '../i18n'
import { useNav } from '../nav'
import { Back, Bell, Check, Plus } from '../ui/icons'
import { PriceMeta, RankBadge, RetailerMark, Tile, TrendTag } from '../ui/bits'
import { PriceChart } from '../ui/PriceChart'
import { inAppLink } from '../data/openLink'
import { PriceSheet } from './PriceSheet'
import { useState } from 'react'

export function ProductScreen({ id }: { id: string }) {
  const { products, pricesOf, retailers, list, setQuantity, markViewed, watched, toggleWatch, t, lang } = useStore()
  const nav = useNav()
  const [adding, setAdding] = useState(false)
  const product = products.find((p) => p.id === id)

  useEffect(() => markViewed(id), [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const observations = pricesOf(id)
  const rows = useMemo(() => (product ? compare(product, observations, retailers) : []), [product, observations, retailers])
  const history = useMemo(() => dailyLowest(id, observations), [id, observations])
  const facts = useMemo(() => priceFacts(history), [history])
  if (!product) return <div className="screen empty">{t('product.notFound')}</div>

  const best = cheapest(rows)
  const fresh = rows.filter((r) => r.freshness === 'fresh')
  const spread = best && fresh.length > 1 ? fresh[fresh.length - 1].current.priceCents - best.current.priceCents : 0
  const inList = list.items.find((i) => i.productId === product.id)
  const isWatched = watched.some((w) => w.productId === product.id)

  return (
    <div className="screen push">
      <div className="topbar center sticky">
        <button className="icon-btn" onClick={nav.back} aria-label={t('product.back')}><Back /></button>
        <span style={{ flex: 1 }} />
        <button
          className={'icon-btn' + (isWatched ? ' on' : '')}
          onClick={() => toggleWatch(product.id, best?.current.priceCents ?? null)}
          aria-label={t(isWatched ? 'watch.on' : 'watch.off')}
          aria-pressed={isWatched}
          title={t(isWatched ? 'watch.on' : 'watch.off')}
        >
          <Bell />
        </button>
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
      {best && (
        <div className="best-card section" style={{ marginTop: 20 }}>
          <div className="best-label">{t('product.cheapestAt')}</div>
          <div className="best-store">{best.retailer.name}</div>
          <div className="best-price">{euro(best.current.priceCents)}</div>
          {facts && facts.now === best.current.priceCents && (facts.droppedFrom || facts.lowest) && (
            <div className="price-flags">
              {facts.droppedFrom && <span className="flag down">{t('price.droppedFrom', { amount: euro(facts.droppedFrom) })}</span>}
              {facts.lowest && <span className="flag">{t('price.lowestDays', { n: facts.days })}</span>}
            </div>
          )}
          <div className="best-meta">
            {[
              best.unitPriceCents != null ? `${euro(best.unitPriceCents)}${unitLabel(product)}` : '',
              fresh.length > 1 ? t('product.comparedN', { n: fresh.length }) : t('product.onlyOne'),
              spread > 0 ? t('product.saveVs', { amount: euro(spread) }) : '',
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <h2>{t('product.byStore')}</h2>
          </div>
        <div className="rows">
          {rows.map((r) => {
            const rank = r.freshness === 'fresh' ? fresh.indexOf(r) + 1 : 0
            const diff = best && rank > 1 ? r.current.priceCents - best.current.priceCents : 0
            const url = r.current.url
            const body = (
              <>
                {rank ? <RankBadge rank={rank} /> : <div className="rank">–</div>}
                <RetailerMark retailer={r.retailer} />
                <div className="grow">
                  <div className="title">{r.retailer.name}</div>
                  <div className="sub"><PriceMeta row={r} /></div>
                </div>
                <div className="end">
                  <div className="price" style={{ color: rank === 1 ? 'var(--accent)' : undefined }}>{euro(r.current.priceCents)}</div>
                  <div className="sub">{rank === 1 && fresh.length > 1 ? t('product.cheapest') : diff > 0 ? `+${euro(diff)}` : r.unitPriceCents != null ? `${euro(r.unitPriceCents)}${unitLabel(product)}` : ''}</div>
                </div>
              </>
            )
            return url ? (
              <a key={r.retailer.id} className="row" href={url} target="_blank" rel="noreferrer" onClick={inAppLink(url)} style={{ opacity: r.freshness === 'outdated' ? 0.6 : 1, color: 'inherit', textDecoration: 'none' }}>
                {body}
              </a>
            ) : (
              <div key={r.retailer.id} className="row" style={{ opacity: r.freshness === 'outdated' ? 0.6 : 1 }}>{body}</div>
            )
          })}
        </div>
      </div>

      {history.length > 1 && facts && <div className="section">
        <div className="section-head">
          <h2>{t('price.history')}</h2>
          <TrendTag pct={trend(product, observations)} />
        </div>
        <div className="card-plain">
          <PriceChart points={history} />
          <div className="price-stats">
            {facts.max === facts.min ? (
              <span>{t('price.stable', { date: facts.since.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' }) })}</span>
            ) : (
              <>
                <span><b>{euro(facts.min)}</b>{t('price.low')}</span>
                <span><b>{euro(facts.max)}</b>{t('price.high')}</span>
                <span><b>{facts.since.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' })}</b>{t('price.since')}</span>
              </>
            )}
          </div>
        </div>
      </div>}

        </>
      )}

      <div className="section actions-row">
        {inList ? (
          <button className="btn ghost" onClick={() => nav.go('lists')}>
            <Check /> {t('product.inList', { n: inList.quantity })}
          </button>
        ) : (
          <button className="btn primary" onClick={() => setQuantity(product.id, 1)}>
            <Plus /> {t('product.add')}
          </button>
        )}
        <button className="btn ghost" onClick={() => setAdding(true)}>{t('product.addPrice')}</button>
      </div>

      {product.infoSource === 'open-food-facts' && (
        <p className="tiny" style={{ marginTop: 20, textAlign: 'center' }}>
          <a href={`https://world.openfoodfacts.org/product/${product.ean}`} target="_blank" rel="noreferrer" onClick={inAppLink(`https://world.openfoodfacts.org/product/${product.ean}`)} style={{ color: 'var(--text-3)' }}>{t('product.info')}</a>
        </p>
      )}
      {adding && <PriceSheet product={product} onClose={() => setAdding(false)} />}
    </div>
  )
}
