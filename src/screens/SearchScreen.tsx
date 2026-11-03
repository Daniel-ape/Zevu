import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { cheapest, compare, euro, sizeLabel, unitLabel, brandLabel } from '../domain/pricing'
import type { CategoryId } from '../domain/types'
import { useNav } from '../nav'
import { Check, Plus, Search } from '../ui/icons'
import { haystack, matchScore } from '../domain/search'
import { CATEGORIES, Tile } from '../ui/bits'
import { EMOJI } from '../data/collectedPrices'

type Sort = 'top' | 'price' | 'unit' | 'name'

export function SearchScreen() {
  const { products, retailers, searchOnline, list, setQuantity, pricesOf, t } = useStore()
  const [added, setAdded] = useState<string | null>(null)
  const [online, setOnline] = useState<'idle' | 'loading' | 'unavailable' | string[]>('idle')
  const nav = useNav()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CategoryId | 'all'>(nav.searchCategory)
  const [sort, setSort] = useState<Sort>('top')
  const [picking, setPicking] = useState(false)
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

  const hay = useMemo(() => new Map(products.map((p) => [p.id, haystack(p)])), [products])
  // Catalogue order is popularity order; shop-only products come after it.
  const rank = useMemo(() => new Map(products.map((p, i) => [p.id, i])), [products])
  const results = useMemo(() => {
    const needle = q.trim()
    const scope = retailers
    // Strong matches (exact or start of a word) first, typo matches last.
    const tier = (score: number) => (score >= 3.5 ? 0 : score >= 2.5 ? 1 : score >= 1.5 ? 2 : 3)
    return products
      .filter((p) => cat === 'all' || p.category === cat)
      .map((p) => ({ p, score: needle ? matchScore(needle, hay.get(p.id)!) || (Array.isArray(online) && online.includes(p.id) ? 2 : 0) : 1 }))
      .filter((r) => r.score > 0)
      // Browsing without a query lists only products that have prices.
      .filter((r) => needle || pricesOf(r.p.id).length > 0)
      .map(({ p, score }) => {
        const rows = compare(p, pricesOf(p.id), scope)
        return { p, score, best: cheapest(rows), count: rows.filter((r) => r.freshness === 'fresh').length }
      })
      // Browsing without a query lists only products that have prices.
      .filter((r) => (needle ? true : r.best || r.count > 0))
      .sort((a, b) => {
        // Typo matches last; otherwise products with a price come first.
        if (needle && (tier(a.score) === 3) !== (tier(b.score) === 3)) return tier(a.score) === 3 ? 1 : -1
        if (!!a.best !== !!b.best) return a.best ? -1 : 1
        if (needle && tier(a.score) !== tier(b.score)) return tier(a.score) - tier(b.score)
        if (sort === 'top') return rank.get(a.p.id)! - rank.get(b.p.id)!
        if (sort === 'name') return a.p.name.localeCompare(b.p.name)
        const av = sort === 'unit' ? a.best?.unitPriceCents : a.best?.current.priceCents
        const bv = sort === 'unit' ? b.best?.unitPriceCents : b.best?.current.priceCents
        return (av ?? Infinity) - (bv ?? Infinity)
      })
      .slice(0, 80)
  }, [q, cat, sort, products, pricesOf, retailers, online, hay, rank])

  // How many products with a price each category has (shown in the picker).
  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const p of products) if (pricesOf(p.id).length) { c.set(p.category, (c.get(p.category) ?? 0) + 1); c.set('all', (c.get('all') ?? 0) + 1) }
    return c
  }, [products, pricesOf])
  const catLabel = (id: CategoryId | 'all') => t(CATEGORIES.find((c) => c.id === id)!.key)
  const catEmoji = (id: CategoryId | 'all') => (id === 'all' ? '🛒' : EMOJI[id])

  const inList = (id: string) => list.items.find((i) => i.productId === id)
  const quickAdd = (id: string) => {
    const item = inList(id)
    setQuantity(id, (item?.quantity ?? 0) + 1)
    setAdded(id)
    setTimeout(() => setAdded((a) => (a === id ? null : a)), 1600)
  }

  return (
    <div className="screen">
      <div className="topbar"><h1>{t('search.title')}</h1></div>
      <label className="search">
        <Search />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} enterKeyHint="search" />
        {q && <button className="tiny muted" onClick={() => setQ('')}>{t('search.clear')}</button>}
      </label>

      <div className="cat-bar">
        <button className={'cat-btn' + (cat !== 'all' ? ' on' : '')} onClick={() => setPicking(true)} aria-haspopup="dialog">
          <span className="cat-emoji">{catEmoji(cat)}</span>
          <span>{cat === 'all' ? t('search.category') : catLabel(cat)}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {cat !== 'all' && <button className="cat-clear" onClick={() => setCat('all')} aria-label={t('search.clear')}>✕</button>}
      </div>

      {picking && (
        <div className="sheet-backdrop" onClick={() => setPicking(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('search.category')} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <h2 style={{ fontSize: 20, margin: '0 4px 14px' }}>{t('search.category')}</h2>
            <div className="cat-grid">
              {CATEGORIES.map((c) => (
                <button key={c.id} className={'cat-tile' + (cat === c.id ? ' on' : '')} onClick={() => { setCat(c.id); setPicking(false) }}>
                  <span className="cat-tile-emoji">{catEmoji(c.id)}</span>
                  <span className="cat-tile-name">{t(c.key)}</span>
                  <span className="cat-tile-n">{counts.get(c.id) ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="section-head" style={{ marginTop: 20 }}>
        <span className="muted small">{results.length === 1 ? t('search.countOne') : t('search.count', { n: results.length })}</span>
        <div className="seg" role="group" aria-label={t('search.sort')}>
          {(['top', 'price', 'unit', 'name'] as Sort[]).map((s) => (
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
              <div key={p.id} className="row search-row">
              <button className="search-open" onClick={() => nav.openProduct(p.id)}>
                <Tile product={p} />
                <div className="grow">
                  <div className="title">{p.name}</div>
                  <div className="sub">{[brandLabel(p.brand), sizeLabel(p)].filter(Boolean).join(' · ')}</div>
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
              <button
                className={'quick-add' + (inList(p.id) ? ' in' : '')}
                onClick={() => quickAdd(p.id)}
                aria-label={t('search.addToList')}
              >
                {added === p.id ? <Check size={18} /> : inList(p.id) ? <span>{inList(p.id)!.quantity}</span> : <Plus size={18} />}
              </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {added && <div className="toast">{t('search.added', { list: list.name === 'Weekly shop' ? t('list.defaultName') : list.name })}</div>}
      {online === 'loading' && <p className="tiny muted" style={{ textAlign: 'center' }}>{t('search.onlineLoading')}</p>}
      {online === 'unavailable' && results.length === 0 && <p className="tiny muted" style={{ textAlign: 'center', lineHeight: 1.5 }}>{t('search.onlineOff')}</p>}
    </div>
  )
}
