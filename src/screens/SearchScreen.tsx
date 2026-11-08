import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { cheapest, compare, euro, sizeLabel, unitLabel, brandLabel } from '../domain/pricing'
import type { CategoryId, Product } from '../domain/types'
import { useNav } from '../nav'
import { Check, Plus, Search } from '../ui/icons'
import { compileQuery, haystack, matchScore } from '../domain/search'
import { CATEGORIES, Tile } from '../ui/bits'
import { EMOJI, EVERYDAY } from '../domain/categories'
import { Sheet } from '../ui/Sheet'

type Sort = 'top' | 'price' | 'unit' | 'name'

// What the Products page looked like when a product was opened from it, so
// coming back shows the same search, category, order and scroll position.
// Work that only depends on the product list is kept between visits, so
// coming back to Products (e.g. from a product) is instant.
const hayCache = new WeakMap<object, Map<string, ReturnType<typeof haystack>>>()
const rankCache = new WeakMap<object, Map<string, number>>()
const countCache = new WeakMap<object, { pricesOf: unknown; c: Map<string, number> }>()
let lastResults: { key: unknown[]; value: unknown } | null = null
const sameKey = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x, i) => x === b[i])

let kept: { q: string; cat: CategoryId | 'all'; sort: Sort; navCat: CategoryId | 'all'; scroll: number } | null = null
const scroller = () => document.querySelector<HTMLElement>('.screen')

export function SearchScreen() {
  const { products, retailers, searchOnline, list, setQuantity, pricesOf, loadMore, moreLoaded, t } = useStore()
  const [added, setAdded] = useState<string | null>(null)
  const [online, setOnline] = useState<'idle' | 'loading' | 'unavailable' | string[]>('idle')
  const nav = useNav()
  // Restore only if nobody asked for another category meanwhile (e.g. from Home).
  const restore = kept && kept.navCat === nav.searchCategory ? kept : null
  const [q, setQ] = useState(restore?.q ?? '')
  const [cat, setCat] = useState<CategoryId | 'all'>(restore?.cat ?? nav.searchCategory)
  const [sort, setSort] = useState<Sort>(restore?.sort ?? 'top')
  const state = useRef({ q, cat, sort })
  state.current = { q, cat, sort }
  const restoreScroll = useRef(restore?.scroll ?? 0)
  useEffect(() => () => {
    const el = scroller()
    kept = { ...state.current, navCat: nav.searchCategory, scroll: el && el.scrollHeight > el.clientHeight ? el.scrollTop : window.scrollY }
  }, [nav.searchCategory])
  const [picking, setPicking] = useState(false)
  const closePicker = useCallback(() => setPicking(false), [])
  const input = useRef<HTMLInputElement>(null)

  // Follow a category picked elsewhere (e.g. on Home), but only when it changes.
  const lastNavCat = useRef(nav.searchCategory)
  useEffect(() => {
    if (lastNavCat.current === nav.searchCategory) return
    lastNavCat.current = nav.searchCategory
    setCat(nav.searchCategory)
  }, [nav.searchCategory])
  // Everyday goods load with the app; the rest of the shops' ranges are fetched
  // the first time someone searches or opens a non-everyday category.
  useEffect(() => {
    if (q.trim().length >= 2 || (cat !== 'all' && !EVERYDAY.has(cat))) loadMore()
  }, [q, cat, loadMore])
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

  const hay = useMemo(() => {
    let h = hayCache.get(products)
    if (!h) { h = new Map(products.map((p) => [p.id, haystack(p)])); hayCache.set(products, h) }
    return h
  }, [products])
  // Catalogue order is popularity order; shop-only products come after it.
  const rank = useMemo(() => {
    let r = rankCache.get(products)
    if (!r) { r = new Map(products.map((p, i) => [p.id, i])); rankCache.set(products, r) }
    return r
  }, [products])
  // Typing updates the field at once; the list follows a moment later, so
  // keys never wait for thousands of products to be scored.
  const dq = useDeferredValue(q)
  // A new category or order closes the picker at once; the list follows.
  const dcat = useDeferredValue(cat)
  const dsort = useDeferredValue(sort)
  const results = useMemo(() => {
    const key = [dq, dcat, dsort, products, pricesOf, retailers, online]
    if (lastResults && sameKey(lastResults.key, key)) return lastResults.value as ReturnType<typeof compute>
    const value = compute()
    lastResults = { key, value }
    return value
    function compute() {
    const needle = dq.trim()
    const query = compileQuery(needle)
    const onlineIds = Array.isArray(online) ? new Set(online) : null
    // Strong matches (exact or start of a word) first, typo matches last.
    const tier = (score: number) => (score >= 3.5 ? 0 : score >= 2.5 ? 1 : score >= 1.5 ? 2 : 3)
    const inCat = dcat === 'all' ? products : products.filter((p) => p.category === dcat)
    const scoreAll = (fuzzy: boolean) => {
      const out: { p: (typeof products)[number]; score: number; priced: boolean }[] = []
      for (const p of inCat) {
        const priced = pricesOf(p.id).length > 0
        // Browsing without a query lists only products that have prices.
        if (!needle) { if (priced) out.push({ p, score: 1, priced }); continue }
        const score = matchScore(query, hay.get(p.id)!, fuzzy) || (onlineIds?.has(p.id) ? 2 : 0)
        if (score > 0) out.push({ p, score, priced })
      }
      return out
    }
    let found = scoreAll(false)
    // Forgive typos only when the exact pass finds little.
    if (needle.length >= 4 && found.length < 24) found = scoreAll(true)
    // Cheap first cut (match strength, has a price, popularity), then the
    // price comparison only for the products that can make the list.
    found.sort((a, b) =>
      (needle ? tier(a.score) - tier(b.score) : 0) || (a.priced === b.priced ? 0 : a.priced ? -1 : 1) || rank.get(a.p.id)! - rank.get(b.p.id)!)
    const pool = dsort === 'top' ? found.slice(0, 160) : found.slice(0, 600)
    return pool
      .map(({ p, score }) => {
        const rows = compare(p, pricesOf(p.id), retailers)
        return { p, score, best: cheapest(rows), count: rows.filter((r) => r.freshness === 'fresh').length }
      })
      .filter((r) => (needle ? true : r.best || r.count > 0))
      .sort((a, b) => {
        // Typo matches last; otherwise products with a price come first.
        if (needle && (tier(a.score) === 3) !== (tier(b.score) === 3)) return tier(a.score) === 3 ? 1 : -1
        if (!!a.best !== !!b.best) return a.best ? -1 : 1
        if (needle && tier(a.score) !== tier(b.score)) return tier(a.score) - tier(b.score)
        if (dsort === 'top') return rank.get(a.p.id)! - rank.get(b.p.id)!
        if (dsort === 'name') return a.p.name.localeCompare(b.p.name)
        const av = dsort === 'unit' ? a.best?.unitPriceCents : a.best?.current.priceCents
        const bv = dsort === 'unit' ? b.best?.unitPriceCents : b.best?.current.priceCents
        return (av ?? Infinity) - (bv ?? Infinity)
      })
      .slice(0, 80)
    }
  }, [dq, dcat, dsort, products, pricesOf, retailers, online, hay, rank])
  const stale = dq !== q || dcat !== cat || dsort !== sort
  // Back from a product: scroll to where the list was, once the rows are there.
  useEffect(() => {
    const y = restoreScroll.current
    if (!y || !results.length) return
    restoreScroll.current = 0
    requestAnimationFrame(() => {
      const el = scroller()
      if (el && el.scrollHeight > el.clientHeight) el.scrollTop = y
      else window.scrollTo(0, y)
    })
  }, [results])

  // How many products with a price each category has (shown in the picker).
  // Counted after the page is drawn (and kept), so opening the picker is instant.
  const [counts, setCounts] = useState<Map<string, number>>(() => {
    const hit = countCache.get(products)
    return hit && hit.pricesOf === pricesOf ? hit.c : new Map()
  })
  useEffect(() => {
    const hit = countCache.get(products)
    if (hit && hit.pricesOf === pricesOf) { setCounts(hit.c); return }
    const id = setTimeout(() => {
      const c = new Map<string, number>()
      for (const p of products) if (pricesOf(p.id).length) { c.set(p.category, (c.get(p.category) ?? 0) + 1); c.set('all', (c.get('all') ?? 0) + 1) }
      countCache.set(products, { pricesOf, c })
      setCounts(c)
    }, 300)
    return () => clearTimeout(id)
  }, [products, pricesOf])
  const catLabel = (id: CategoryId | 'all') => t(CATEGORIES.find((c) => c.id === id)!.key)
  const catEmoji = (id: CategoryId | 'all') => (id === 'all' ? '🛒' : EMOJI[id])

  const inList = (id: string) => list.items.find((i) => i.productId === id)
  // Stable handlers, so result rows that did not change are not drawn again while typing.
  const latest = useRef({ list, setQuantity, nav })
  latest.current = { list, setQuantity, nav }
  const quickAdd = useCallback((id: string) => {
    const { list, setQuantity } = latest.current
    const item = list.items.find((i) => i.productId === id)
    setQuantity(id, (item?.quantity ?? 0) + 1)
    setAdded(id)
    setTimeout(() => setAdded((a) => (a === id ? null : a)), 1600)
  }, [])
  const openProduct = useCallback((id: string) => latest.current.nav.openProduct(id), [])

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
        <Sheet title={t('search.category')} onClose={closePicker} closeLabel={t('common.close')}>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={'cat-tile' + (cat === c.id ? ' on' : '') + (counts.size && !counts.get(c.id) && c.id !== 'all' ? ' empty' : '')} onClick={() => { setCat(c.id); setPicking(false) }}>
                <span className="cat-tile-emoji">{catEmoji(c.id)}</span>
                <span className="cat-tile-name">{t(c.key)}</span>
                <span className="cat-tile-n">{counts.get(c.id) ?? 0}</span>
              </button>
            ))}
          </div>
        </Sheet>
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
          <div className="rows" style={{ opacity: stale ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            {results.map(({ p, best, count }) => (
              <ResultRow key={p.id} p={p} best={best} count={count} sort={sort} qty={inList(p.id)?.quantity ?? 0}
                justAdded={added === p.id} onOpen={openProduct} onAdd={quickAdd} noPrice={t('search.noPrice')} addLabel={t('search.addToList')} />
            ))}
          </div>
        </div>
      )}
      {added && <div className="toast">{t('search.added', { list: list.name === 'Weekly shop' ? t('list.defaultName') : list.name })}</div>}
      {moreLoaded === 'loading' && <p className="tiny muted" style={{ textAlign: 'center' }}>{t('search.moreLoading')}</p>}
      {online === 'loading' && <p className="tiny muted" style={{ textAlign: 'center' }}>{t('search.onlineLoading')}</p>}
      {online === 'unavailable' && results.length === 0 && <p className="tiny muted" style={{ textAlign: 'center', lineHeight: 1.5 }}>{t('search.onlineOff')}</p>}
    </div>
  )
}

type Best = ReturnType<typeof cheapest>

const ResultRow = memo(function ResultRow({ p, best, count, sort, qty, justAdded, onOpen, onAdd, noPrice, addLabel }: {
  p: Product; best: Best; count: number; sort: Sort; qty: number; justAdded: boolean
  onOpen: (id: string) => void; onAdd: (id: string) => void; noPrice: string; addLabel: string
}) {
  return (
    <div className="row search-row">
      <button className="search-open" onClick={() => onOpen(p.id)}>
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
            <div className="sub">{noPrice}</div>
          )}
        </div>
      </button>
      <button className={'quick-add' + (qty ? ' in' : '')} onClick={() => onAdd(p.id)} aria-label={addLabel}>
        {justAdded ? <Check size={18} /> : qty ? <span>{qty}</span> : <Plus size={18} />}
      </button>
    </div>
  )
})
