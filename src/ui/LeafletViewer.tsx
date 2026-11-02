import { useRef, useState } from 'react'
import { useStore } from '../data/store'
import { euro } from '../domain/pricing'
import type { Leaflet } from '../domain/leaflets'
import { LOCALE } from '../i18n'
import { Check, Plus } from './icons'
import { Tile } from './bits'

/** Full-screen leaflet: swipe between pages, pinch to zoom, add offers to the list. */
export function LeafletViewer({ leaflet, title, onClose }: { leaflet: Leaflet; title: string; onClose: () => void }) {
  const { products, list, setQuantity, t, lang } = useStore()
  const [page, setPage] = useState(0)
  const strip = useRef<HTMLDivElement>(null)
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'numeric' })

  const go = (i: number) => {
    const el = strip.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="leaflet" role="dialog" aria-label={title}>
      <div className="leaflet-head">
        <div>
          <div className="title" style={{ fontWeight: 700 }}>{title}</div>
          <div className="tiny muted">{t('leaflet.valid', { from: fmt(leaflet.validFrom), to: fmt(leaflet.validTo) })}</div>
        </div>
        <button className="link" onClick={onClose}>{t('rc.close')}</button>
      </div>
      {leaflet.source === 'sample' && <div className="leaflet-sample">{t('leaflet.sampleNote')}</div>}

      <div
        ref={strip}
        className="leaflet-pages"
        onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {leaflet.pages.map((pg, i) => (
          <section key={i} className="leaflet-page" aria-label={t('leaflet.page', { n: i + 1, m: leaflet.pages.length })}>
            {pg.imageUrl ? (
              <img src={pg.imageUrl} alt="" className="leaflet-img" />
            ) : (
              <div className="leaflet-sheet">
                {pg.heading && <div className="leaflet-banner">{pg.heading}</div>}
                <div className="leaflet-grid">
                  {pg.offers?.map((o) => {
                    const p = products.find((x) => x.id === o.productId)
                    const inList = list.items.some((it) => it.productId === o.productId)
                    const pct = o.normalCents ? Math.round((1 - o.priceCents / o.normalCents) * 100) : 0
                    return (
                      <div key={o.productId} className="leaflet-offer">
                        {pct >= 5 && <span className="leaflet-pct">−{pct}%</span>}
                        {p && <Tile product={p} large />}
                        <div className="leaflet-name">{o.title}</div>
                        <div className="leaflet-price">{euro(o.priceCents)}</div>
                        {o.normalCents && <div className="tiny muted" style={{ textDecoration: 'line-through' }}>{euro(o.normalCents)}</div>}
                        {o.limit && <div className="tiny muted">{t('leaflet.limit', { n: o.limit })}</div>}
                        <button
                          className={'leaflet-add' + (inList ? ' on' : '')}
                          onClick={() => setQuantity(o.productId, inList ? 0 : 1)}
                          aria-label={inList ? t('product.inList', { n: 1 }) : t('product.add')}
                        >
                          {inList ? <Check size={18} /> : <Plus size={18} />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="leaflet-dots">
        {leaflet.pages.map((_, i) => (
          <button key={i} className={i === page ? 'on' : ''} onClick={() => go(i)} aria-label={t('leaflet.page', { n: i + 1, m: leaflet.pages.length })} />
        ))}
      </div>
    </div>
  )
}
