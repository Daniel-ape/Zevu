import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { cheapest, compare, euro, sizeLabel, unitLabel } from '../domain/pricing'
import type { CategoryId } from '../domain/types'
import { useNav } from '../nav'
import { Search } from '../ui/icons'
import { CATEGORIES, Tile } from '../ui/bits'

type Sort = 'price' | 'unit' | 'name'

export function SearchScreen() {
  const { products, observations, retailers, searchOnline, t } = useStore()
  const [online, setOnline] = useState<'idle' | 'loading' | 'unavailable' | string[]>('idle')
  const nav = useNav()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CategoryId | 'all'>(nav.searchCategory)
  const [sort, setSort] = useState<Sort>('price')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => setCat(nav.searchCategory), [nav.searchCategory])
  useEffect(() => {
    if (nav.searchFocus) input.current?.focus()
  }, [nav.searchFocus])

  // Look further in Open Food Facts once the user has typed a few letters.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 3) return setOnline('idle')
    setOnline('loading')
    let live = true
    const timer = setTimeout(async () => {
      const res = await searchOnline(term)
      if (live) setOnline(res === 'unavailable' ? 'unavailable' : res.map((p) => p.id))
    }, 450)
    return () => { live = false; clearTimeout(timer) }
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const scope = retailers
    return products
      .filter((p) => cat === 'all' || p.category === cat)
      .filter((p) => !needle || `${p.name} ${p.brand} ${p.ean}`.toLowerCase().includes(needle) || (Array.isArray(online) && online.includes(p.id)))
      .map((p) => {
        const rows = compare(p, observations, scope)
        return { p, best: cheapest(rows), count: rows.filter((r) => r.freshness === 'fresh').length }
      })
      // Browsing without a query lists only products that have prices.
      .filter((r) => (needle ? true : r.best || r.count > 0))
      .sort((a, b) => {
        if (sort === 'name') return a.p.name.localeCompare(b.p.name)
        const av = sort === 'unit' ? a.best?.unitPriceCents : a.best?.current.priceCents
        const bv = sort === 'unit' ? b.best?.unitPriceCents : b.best?.current.priceCents
        return (av ?? Infinity) - (bv ?? Infinity)
      })
      .slice(0, 80)
  }, [q, cat, sort, products, observations, retailers, online])

  return (
    <div className="screen">
      <div className="topbar"><h1>{t('search.title')}</h1></div>
      <label className="search">
        <Search />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} enterKeyHint="search" />
        {q && <button className="tiny muted" onClick={() => setQ('')}>{t('search.clear')}</button>}
      </label>

      <div className="chips" style={{ marginTop: 16 }}>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>{t(c.key)}</button>
        ))}
      </div>

      <div className="section-head" style={{ marginTop: 20 }}>
        <span className="muted small">{results.length === 1 ? t('search.countOne') : t('search.count', { n: results.length })}</span>
        <div className="seg" role="group" aria-label={t('search.sort')}>
          {(['price', 'unit', 'name'] as Sort[]).map((s) => (
            <button key={s} className={sort === s ? 'on' : ''} onClick={() => setSort(s)}>
              {t(`sort.${s}`)}
            </button>
          ))}
        </div>
      </div>


      {results.length === 0 && !q.trim() ? (
        <div className="empty">{t('search.hint', { n: products.length })}</div>
      ) : results.length === 0 && online !== 'loading' ? (
        <div className="empty">{t('search.none', { q })}</div>
      ) : (
        <div>
          <div className="rows">
            {results.map(({ p, best, count }) => (
              <button key={p.id} className="row" onClick={() => nav.openProduct(p.id)}>
                <Tile product={p} />
                <div className="grow">
                  <div className="title">{p.name}</div>
                  <div className="sub">{[p.brand, sizeLabel(p)].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="end">
                  {best ? (
                    <>
                      <div className="price">{euro(best.current.priceCents)}</div>
                      <div className="sub">
                        {sort === 'unit' && best.unitPriceCents !== null
                          ? `${euro(best.unitPriceCents)}${unitLabel(p)}`
                          : `${best.retailer.name}${count > 1 ? ` +${count - 1}` : ''}`}
                      </div>
                    </>
                  ) : (
                    <div className="sub">{t('search.noPrice')}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {online === 'loading' && <p className="tiny muted" style={{ textAlign: 'center' }}>{t('search.onlineLoading')}</p>}
      {online === 'unavailable' && results.length === 0 && <p className="tiny muted" style={{ textAlign: 'center', lineHeight: 1.5 }}>{t('search.onlineOff')}</p>}
    </div>
  )
}
