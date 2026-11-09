import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { basketTotals, cheapest, compare, euro, sizeLabel, trend } from '../domain/pricing'
import { useNav } from '../nav'
import { ArrowRight, List } from '../ui/icons'
import { Tile, TrendTag } from '../ui/bits'
import { Cover, useShelf } from './Leaflets'
import { favFirst, useFavLeaflets } from '../data/favLeaflets'
import { HomeMemberOffers } from './Coupons'
import { openProfilePage } from './Profile'
import { SaveCard } from '../ui/SaveCard'
import { ProfileButton } from '../ui/ProfileButton'
import { WatchBell } from '../ui/WatchBell'
import { WatchAlert } from '../ui/WatchAlert'
import { useListDeals } from '../data/listDeals'
import type { Key } from '../i18n'

function greeting(): Key {
  const h = new Date().getHours()
  return h < 5 ? 'home.night' : h < 11 ? 'home.morning' : h < 17 ? 'home.day' : h < 22 ? 'home.evening' : 'home.night'
}

/** How many watched products Home shows; the rest are on the watch page. */
const HOME_WATCH = 3

export function Home() {
  const { products, observations, retailers, list, watched, lang, pricesOf, t } = useStore()
  const nav = useNav()
  const { shelf } = useShelf()
  const listName = list.name === 'Weekly shop' ? t('list.defaultName') : list.name
  const itemCount = list.items.reduce((n, i) => n + i.quantity, 0)

  const totals = useMemo(
    () => basketTotals(list, products, observations, retailers),
    [list, products, observations, retailers],
  )
  const best = totals.find((x) => x.missing === 0)
  const worst = [...totals].filter((x) => x.missing === 0).sort((a, b) => b.totalCents - a.totalCents)[0]
  const saving = best && worst ? worst.totalCents - best.totalCents : 0

  const month = new Date().toLocaleDateString(lang === 'sv' ? 'sv-FI' : lang === 'fi' ? 'fi-FI' : 'en-GB', { month: 'long' })


  const drops = useMemo(
    () =>
      products
        .filter((p) => pricesOf(p.id).length > 4)
        .map((p) => ({ p, pct: trend(p, pricesOf(p.id)) }))
        .filter((d): d is { p: typeof d.p; pct: number } => d.pct !== null && d.pct < -1)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 4),
    [products, pricesOf],
  )

  const favs = useFavLeaflets()
  const leaflets = favFirst(shelf.flatMap((c) => c.leaflets.map((l) => ({ chain: c.chain, l }))), (x) => x.l.url, favs)
    .sort((a, b) => (a.l.status === 'now' ? 0 : 1) - (b.l.status === 'now' ? 0 : 1))
    .slice(0, 8)

  const today = new Date().toLocaleDateString(lang === 'sv' ? 'sv-FI' : lang === 'fi' ? 'fi-FI' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="screen home">
      <div className="home-head">
        <div>
          <div className="eyebrow">{today}</div>
          <h1>{t(greeting())}</h1>
        </div>
        <div className="home-actions">
          <WatchBell />
          <ProfileButton />
        </div>
      </div>

      <WatchAlert />
      <SaveCard month={month} bestShop={best?.retailer.name} onOpen={() => { openProfilePage('spending', nav.tab); nav.go('profile') }} />


      {list.items.length > 0 && (
        <button className="list-card section" style={{ marginTop: 18 }} onClick={() => nav.go('lists')}>
          <span className="quick-icon"><List size={22} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{listName} · {itemCount === 1 ? t('list.items1') : t('list.items', { n: itemCount })}</b>
            <span className="sub">
              {best ? t('home.cheapestStore', { store: best.retailer.name }) + (saving > 0 ? ' · ' + t('home.saveUpTo', { amount: euro(saving) }) : '') : t('home.noListPrices')}
            </span>
          </span>
          {best ? <span className="price">{euro(best.totalCents)}</span> : <ArrowRight size={16} />}
        </button>
      )}

      <ListDeals />

      <HomeMemberOffers />

      {leaflets.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('home.leaflets')}</h2>
            <button className="link small" onClick={() => nav.go('leaflets')}>{t('home.seeAll')} <ArrowRight size={14} /></button>
          </div>
          <div className="strip covers-strip">
            {leaflets.map(({ chain, l }) => <Cover key={l.url} chain={chain} l={l} compact logo />)}
          </div>
        </div>
      )}

      {drops.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('home.drops')}</h2>
            <span className="muted tiny">{t('home.last4w')}</span>
          </div>
          <div className="rows">
            {drops.map(({ p, pct }) => {
              const c = cheapest(compare(p, pricesOf(p.id), retailers))
              return (
                <button key={p.id} className="row" onClick={() => nav.openProduct(p.id)}>
                  <Tile product={p} />
                  <div className="grow">
                    <div className="title">{p.name}</div>
                    <div className="sub">{[sizeLabel(p), c?.retailer.name].filter(Boolean).join(' · ')}</div>
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
      )}

      {watched.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('watch.title')}</h2>
            {watched.length > HOME_WATCH && (
              <button className="link" onClick={() => { openProfilePage('watched', nav.tab); nav.go('profile') }}>{t('home.seeAllN', { n: watched.length })}</button>
            )}
          </div>
          <div className="rows">
            {watched
              .map((w) => {
                const p = products.find((x) => x.id === w.productId)
                const c = p ? cheapest(compare(p, pricesOf(p.id), retailers)) : undefined
                const now = c?.current.priceCents ?? null
                const diff = now !== null && w.baselineCents !== null ? now - w.baselineCents : null
                return { w, p, c, now, diff }
              })
              // Biggest drops first; Home shows a few, the rest are under "See all".
              .sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0))
              .slice(0, HOME_WATCH)
              .map(({ w, p, c, now, diff }) => {
              if (!p) return null
              return (
                <button key={w.productId} className="row" onClick={() => nav.openProduct(p.id)}>
                  <Tile product={p} />
                  <div className="grow">
                    <div className="title">{p.name}</div>
                    <div className="sub">{c ? c.retailer.name : t('watch.noPrice')}</div>
                  </div>
                  <div className="end">
                    {now !== null && <div className="price">{euro(now)}</div>}
                    {diff !== null && (
                      <div className="tiny" style={{ fontWeight: 600, color: diff < 0 ? 'var(--good)' : diff > 0 ? 'var(--warn)' : 'var(--text-2)' }}>
                        {diff < 0 ? t('watch.cheaper', { amount: euro(-diff) }) : diff > 0 ? t('watch.dearer', { amount: euro(diff) }) : t('watch.same')}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {watched.length > HOME_WATCH && (
            <button className="see-more" onClick={() => { openProfilePage('watched', nav.tab); nav.go('profile') }}>
              {t('home.moreWatched', { n: watched.length - HOME_WATCH })}
            </button>
          )}
        </div>
      )}



    </div>
  )
}

/** "On offer this week" for the products on the shopping list. */
function ListDeals() {
  const deals = useListDeals()
  const { t } = useStore()
  const nav = useNav()
  const [all, setAll] = useState(false)
  if (!deals.length) return null
  const shown = all ? deals : deals.slice(0, 3)
  return (
    <div className="section">
      <div className="section-head">
        <h2>{t('ld.title')}</h2>
        <span className="small muted">{t(deals.length === 1 ? 'ld.count1' : 'ld.count', { n: deals.length })}</span>
      </div>
      <div className="rows group-rows ld-rows">
        {shown.map((d) => (
          <button key={d.product.id} className="row" onClick={() => nav.openProduct(d.product.id)}>
            <Tile product={d.product} />
            <div className="grow">
              <div className="title">{d.product.name}</div>
              <div className="sub">{d.store}{d.leaflet ? ' · ' + t('ld.leaflet') : ''}</div>
            </div>
            <div className="ld-price">
              <b>{euro(d.priceCents)}</b>
              {d.wasCents && d.wasCents > d.priceCents && <span className="ld-off">−{Math.round((1 - d.priceCents / d.wasCents) * 100)} %</span>}
            </div>
          </button>
        ))}
      </div>
      {deals.length > 3 && <button className="link small see-more" onClick={() => setAll(!all)}>{all ? t('gap.less') : t('home.seeAllN', { n: deals.length })}</button>}
    </div>
  )
}

