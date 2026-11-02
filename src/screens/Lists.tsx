import { useMemo } from 'react'
import { useStore } from '../data/store'
import { basketTotals, cheapest, compare, euro, sizeLabel } from '../domain/pricing'
import { useNav } from '../nav'
import { Minus, Plus } from '../ui/icons'
import { RankBadge, RetailerMark, SampleNotice, Tile } from '../ui/bits'

export function Lists() {
  const { list, products, observations, retailers, setQuantity, t } = useStore()
  const listName = list.name === 'Weekly shop' ? t('list.defaultName') : list.name
  const nav = useNav()
  const totals = useMemo(
    () => basketTotals(list, products, observations, retailers),
    [list, products, observations, retailers],
  )
  const complete = totals.filter((t) => t.missing === 0)
  const incomplete = totals.filter((t) => t.missing > 0)
  const best = complete[0]
  const itemCount = list.items.reduce((n, i) => n + i.quantity, 0)

  return (
    <div className="screen">
      <div className="topbar">
        <h1>{listName}</h1>
      </div>

      {list.items.length === 0 ? (
        <div className="empty">
          {t('list.empty')}
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" style={{ maxWidth: 220 }} onClick={() => nav.go('search', { focus: true })}>{t('list.find')}</button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <div className="rows">
              {list.items.map((item) => {
                const p = products.find((x) => x.id === item.productId)
                if (!p) return null
                const c = cheapest(compare(p, observations, retailers))
                return (
                  <div key={p.id} className="row">
                    <button onClick={() => nav.openProduct(p.id)}><Tile product={p} /></button>
                    <button className="grow" style={{ textAlign: 'left' }} onClick={() => nav.openProduct(p.id)}>
                      <div className="title">{p.name}</div>
                      <div className="sub">{sizeLabel(p)}{c ? ` · ${t('list.from', { price: euro(c.current.priceCents) })}` : ''}</div>
                    </button>
                    <div className="stepper">
                      <button onClick={() => setQuantity(p.id, item.quantity - 1)} aria-label={t('list.less')}><Minus size={16} /></button>
                      <span>{item.quantity}</span>
                      <button onClick={() => setQuantity(p.id, item.quantity + 1)} aria-label={t('list.more')}><Plus size={16} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <button className="link" style={{ marginTop: 12 }} onClick={() => nav.go('search', { focus: true })}>
            <Plus size={16} /> {t('list.add')}
          </button>

          <div className="section">
            <div className="section-head">
              <h2>{t('list.where')}</h2>
              <span className="muted tiny">{t('list.items', { n: itemCount })}</span>
            </div>
            <SampleNotice compact />
            <div className="rows">
              {complete.map((bt) => {
                const rank = complete.indexOf(bt) + 1
                const diff = best && rank > 1 ? bt.totalCents - best.totalCents : 0
                return (
                  <div key={bt.retailer.id} className="row">
                    <RankBadge rank={rank} />
                    <RetailerMark retailer={bt.retailer} />
                    <div className="grow">
                      <div className="title">{bt.retailer.name}</div>
                      <div className="sub">
                        {rank === 1 ? t('list.cheapest') : `+${euro(diff)}`}
                      </div>
                    </div>
                    <div className="end">
                      <div className="price" style={{ color: rank === 1 ? 'var(--accent)' : undefined }}>
                        {euro(bt.totalCents)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {incomplete.length > 0 && (
              <p className="tiny muted" style={{ marginTop: 6 }}>
                {t('list.notRanked', { stores: incomplete.map((x) => x.retailer.name).join(', ') })}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
