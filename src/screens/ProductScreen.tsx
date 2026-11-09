import { useEffect, useMemo } from 'react'
import { useStore } from '../data/store'
import { cheapest, compare, dailyByStore, dailyLowest, euro, priceFacts, sizeLabel, trend, unitLabel, brandLabel } from '../domain/pricing'
import { LOCALE } from '../i18n'
import { EVERYDAY } from '../domain/categories'
import { useNav } from '../nav'
import { Back, Check, Plus } from '../ui/icons'
import { PriceMeta, RankBadge, RetailerMark, Tile, TrendTag } from '../ui/bits'
import { PriceChart } from '../ui/PriceChart'
import { StoreChart } from '../ui/StoreChart'
import { inAppLink } from '../data/openLink'
import { PriceSheet } from './PriceSheet'
import { cheaperAlternatives } from '../domain/alternatives'
import { useState } from 'react'

export function ProductScreen({ id }: { id: string }) {
  const { products, pricesOf, retailers, list, setQuantity, markViewed, watched, toggleWatch, t, lang } = useStore()
  const nav = useNav()
  const [adding, setAdding] = useState<false | { store?: string }>(false)
  const product = products.find((p) => p.id === id)

  useEffect(() => markViewed(id), [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const observations = pricesOf(id)
  const rows = useMemo(() => (product ? compare(product, observations, retailers) : []), [product, observations, retailers])
  const history = useMemo(() => dailyLowest(id, observations), [id, observations])
  const facts = useMemo(() => priceFacts(history), [history])
  const perStore = useMemo(() => dailyByStore(id, observations, retailers), [id, observations, retailers])
  // Lowest and highest over every shop's line when there are several.
  const range = useMemo(() => {
    const v = perStore.series.flatMap((x) => x.values.filter((c): c is number => c !== null))
    return v.length && perStore.series.length > 0 ? { min: Math.min(...v), max: Math.max(...v) } : facts ? { min: facts.min, max: facts.max } : null
  }, [perStore, facts])
  if (!product) return <div className="screen empty">{t('product.notFound')}</div>

  const best = cheapest(rows)
  // The same kind of product from another brand, clearly cheaper per kg / l / piece.
  const alternatives = useMemo(() => {
    if (!product) return []
    const same = products.filter((p) => p.category === product.category)
    return cheaperAlternatives(product, same, (p) => {
      const b = cheapest(compare(p, pricesOf(p.id), retailers))
      return b ? { cents: b.current.priceCents, store: b.retailer.name } : null
    })
  }, [product, products, pricesOf, retailers])
  // Grocery chains the user shops at that have no price for this product yet:
  // listed so the price can be added from a shelf label (S and K groups don't publish theirs).
  const GROCERY = ['prisma', 's-market', 'sale', 'alepa', 'k-citymarket', 'k-supermarket', 'k-market', 'lidl', 'tokmanni', 'halpahalli']
  const missing = EVERYDAY.has(product.category)
    ? retailers.filter((r) => GROCERY.includes(r.id) && !rows.some((x) => x.retailer.id === r.id))
    : []
  const fresh = rows.filter((r) => r.freshness === 'fresh')
  const inList = list.items.find((i) => i.productId === product.id)
  const isWatched = watched.some((w) => w.productId === product.id)

  return (
    <div className="screen push">
      <div className="topbar center sticky">
        <button className="icon-btn" onClick={nav.back} aria-label={t('product.back')}><Back /></button>
      </div>

      {/* Big picture, the name, the best price large, and the actions under it */}
      <div className="pd-hero"><Tile product={product} large /></div>
      <h1 className="pd-name">{product.name}</h1>
      <div className="pd-brand">{[brandLabel(product.brand), sizeLabel(product)].filter(Boolean).join(' · ')}</div>
      {best && (
        <div className="pd-price-block">
          <div className="pd-price">{euro(best.current.priceCents)}</div>
          <div className="pd-meta">
            {[best.retailer.name, best.unitPriceCents != null ? `${euro(best.unitPriceCents)}${unitLabel(product)}` : ''].filter(Boolean).join(' · ')}
          </div>
          {facts?.droppedFrom && facts.now === best.current.priceCents && (
            <div className="price-flags"><span className="flag down">{t('price.droppedFrom', { amount: euro(facts.droppedFrom) })}</span></div>
          )}
        </div>
      )}
      <div className="pd-actions">
        {inList ? (
          <button className="pd-add in" onClick={() => nav.go('lists')} aria-label={t('product.inList', { n: inList.quantity })}>
            <Check size={22} /><span>{inList.quantity}</span>
          </button>
        ) : (
          <button className="pd-add" onClick={() => setQuantity(product.id, 1)} aria-label={t('product.add')}><Plus size={26} /></button>
        )}
        <button className={'pd-act' + (isWatched ? ' on' : '')} onClick={() => toggleWatch(product.id, best?.current.priceCents ?? null)}
          aria-label={t(isWatched ? 'watch.on' : 'watch.off')} aria-pressed={isWatched} title={t(isWatched ? 'watch.on' : 'watch.off')}>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M12 20.5s-7.5-4.4-9.3-9.2C1.6 8.2 3.6 5 6.9 5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.3 0 5.3 3.2 4.2 6.3-1.8 4.8-9.3 9.2-9.3 9.2z" fill={isWatched ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="notice-plain section">
          <div className="title" style={{ fontWeight: 600, marginBottom: 6 }}>{t('product.noPricesYet')}</div>
          <div className="small muted" style={{ lineHeight: 1.5 }}>{t('product.noPricesHint')}</div>
        </div>
      ) : (
        <>

      {alternatives.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>{t('alt.title')}</h2></div>
          <div className="rows group-rows">
            {alternatives.map((a) => (
              <button key={a.product.id} className="row" onClick={() => nav.openProduct(a.product.id)}>
                <Tile product={a.product} />
                <div className="grow">
                  <div className="title">{a.product.name}</div>
                  <div className="sub">{[a.store, sizeLabel(a.product), `${euro(a.unitCents)}${unitLabel(a.product)}`].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="ld-price">
                  <b>{euro(a.cents)}</b>
                  <span className="alt-off">−{a.cheaperBy} %{unitLabel(a.product)}</span>
                </div>
              </button>
            ))}
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

      {(perStore.series.length > 0 || history.length > 1) && facts && <div className="section">
        <div className="section-head">
          <h2>{t('price.history')}</h2>
          <TrendTag pct={trend(product, observations)} />
        </div>
        <div className="card-plain">
          {perStore.series.length > 0 ? <StoreChart dates={perStore.dates} series={perStore.series} /> : <PriceChart points={history} />}
          <div className="price-stats">
            {range && range.max === range.min ? (
              <span>{t('price.stable', { date: facts.since.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' }) })}</span>
            ) : (
              <>
                <span><b>{euro(range!.min)}</b>{t('price.low')}</span>
                <span><b>{euro(range!.max)}</b>{t('price.high')}</span>
                <span><b>{facts.since.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' })}</b>{t('price.since')}</span>
              </>
            )}
          </div>
        </div>
      </div>}

        </>
      )}

      {missing.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>{t('product.noPriceAt')}</h2></div>
          <div className="missing-note">{t('product.addHere')}</div>
          <div className="missing-chips">
            {missing.map((r) => (
              <button key={r.id} className="missing-chip" onClick={() => setAdding({ store: r.id })}>
                <Plus size={14} /> {r.name}
              </button>
            ))}
          </div>
        </div>
      )}


      {product.infoSource === 'open-food-facts' && (
        <p className="tiny" style={{ marginTop: 20, textAlign: 'center' }}>
          <a href={`https://world.openfoodfacts.org/product/${product.ean}`} target="_blank" rel="noreferrer" onClick={inAppLink(`https://world.openfoodfacts.org/product/${product.ean}`)} style={{ color: 'var(--text-3)' }}>{t('product.info')}</a>
        </p>
      )}
      {adding && <PriceSheet product={product} store={adding.store} onClose={() => setAdding(false)} />}
    </div>
  )
}
