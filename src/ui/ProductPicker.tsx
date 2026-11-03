import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { haystack, matchScore } from '../domain/search'
import { sizeLabel, brandLabel } from '../domain/pricing'
import { Tile } from './bits'
import { Search } from './icons'

/** Sheet to choose a product by searching, e.g. to link a receipt line. */
export function ProductPicker({ initial, onPick, onClose }: { initial: string; onPick: (id: string | undefined) => void; onClose: () => void }) {
  const { products, addOwnProduct, t } = useStore()
  const [q, setQ] = useState(initial)
  const hay = useMemo(() => new Map(products.map((p) => [p.id, haystack(p)])), [products])
  const results = useMemo(() => {
    const term = q.trim()
    if (term.length < 2) return []
    return products
      .map((p) => ({ p, s: matchScore(term, hay.get(p.id)!) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
  }, [q, products, hay])

  return (
    <div className="sheet-backdrop" style={{ zIndex: 70 }} onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('rc.pick')} onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-grab" />
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2>{t('rc.pick')}</h2>
          <button className="link" onClick={onClose}>{t('rc.cancel')}</button>
        </div>
        <label className="search">
          <Search />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} />
        </label>
        <div className="rows" style={{ overflowY: 'auto', marginTop: 8, flex: 1 }}>
          <button className="row" onClick={() => onPick(undefined)}>
            <div className="grow"><div className="title muted">{t('rc.notLinked')}</div></div>
          </button>
          {q.trim().length >= 3 && (
            <button className="row" onClick={() => onPick(addOwnProduct({ ean: '', name: q.trim().replace(/^./, (c) => c.toUpperCase()), category: 'pantry' }).id)}>
              <div className="grow"><div className="title" style={{ color: 'var(--accent)' }}>+ {t('rc.newProduct', { name: q.trim() })}</div></div>
            </button>
          )}
          {results.map(({ p }) => (
            <button key={p.id} className="row" onClick={() => onPick(p.id)}>
              <Tile product={p} />
              <div className="grow">
                <div className="title">{p.name}</div>
                <div className="sub">{[brandLabel(p.brand), sizeLabel(p)].filter(Boolean).join(' · ')}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
