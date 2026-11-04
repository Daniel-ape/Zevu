import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { basketTotals, cheapest, compare, euro, sizeLabel, storeInsights, trend } from '../domain/pricing'
import { useNav } from '../nav'
import { ArrowRight, List, Receipt, Scan as ScanIcon, Ticket } from '../ui/icons'
import { Tile, TrendTag } from '../ui/bits'
import { ReceiptSheet } from './ReceiptSheet'
import { monthSavings } from '../domain/receipts'
import { Cover, useShelf } from './Leaflets'
import { HomeMemberOffers } from './Coupons'
import type { Key } from '../i18n'

function greeting(): Key {
  const h = new Date().getHours()
  return h < 5 ? 'home.night' : h < 11 ? 'home.morning' : h < 17 ? 'home.day' : h < 22 ? 'home.evening' : 'home.night'
}

export function Home() {
  const { products, observations, retailers, list, watched, lang, pricesOf, receipts, coupons, t } = useStore()
  const activeCoupons = coupons.filter((c) => !c.used && (!c.validUntil || new Date(c.validUntil + 'T23:59') >= new Date())).length
  const nav = useNav()
  const [receipt, setReceipt] = useState(false)
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

  const savings = useMemo(() => monthSavings(receipts, pricesOf), [receipts, pricesOf])
  const month = new Date().toLocaleDateString(lang === 'sv' ? 'sv-FI' : lang === 'fi' ? 'fi-FI' : 'en-GB', { month: 'long' })

  const insights = useMemo(() => storeInsights(products, pricesOf, retailers), [products, pricesOf, retailers])
  const [gapsAll, setGapsAll] = useState(false)

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

  const leaflets = shelf.flatMap((c) => c.leaflets.map((l) => ({ chain: c.chain, l })))
    .sort((a, b) => (a.l.status === 'now' ? 0 : 1) - (b.l.status === 'now' ? 0 : 1))
    .slice(0, 8)

  const today = new Date().toLocaleDateString(lang === 'sv' ? 'sv-FI' : lang === 'fi' ? 'fi-FI' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="screen home">
      <div className="home-head">
        <div className="eyebrow">{today}</div>
        <h1>{t(greeting())}</h1>
      </div>

      <div className="save-card">
        <div className="save-label">{t('save.title', { month })}</div>
        <div className="save-amount">{euro(savings.savedCents)}</div>
        {savings.receipts === 0 ? (
          <>
            <div className="save-sub">{t('save.empty')}</div>
            <button className="btn primary save-btn" onClick={() => setReceipt(true)}><Receipt size={18} /> {t('save.scan')}</button>
          </>
        ) : (
          <>
            <div className="save-sub">
              {t('save.vsAvg')} · {t(savings.receipts === 1 ? 'save.receipts1' : 'save.receipts', { n: savings.receipts })} · {t('save.spent', { amount: euro(savings.spentCents) })}
            </div>
            {savings.missedCents > 0 && <div className="save-missed">{t('save.missed', { amount: euro(savings.missedCents) })}</div>}
            {savings.compared === 0 && <div className="save-missed">{t('save.noCompare')}</div>}
            <button className="save-link" onClick={() => setReceipt(true)}><Receipt size={16} /> {t('save.add')}</button>
          </>
        )}
      </div>

      <div className="quick3">
        <button onClick={() => nav.go('scan')}><span className="q-ic"><ScanIcon size={22} /></span>{t('qa.scan')}</button>
        <button onClick={() => nav.go('lists')}><span className="q-ic"><List size={22} />{itemCount > 0 && <i>{itemCount}</i>}</span>{t('qa.list')}</button>
        <button onClick={() => nav.go('coupons')}><span className="q-ic"><Ticket size={22} />{activeCoupons > 0 && <i>{activeCoupons}</i>}</span>{t('cp.short')}</button>
      </div>

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

      <HomeMemberOffers />

      {leaflets.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('home.leaflets')}</h2>
            <button className="link small" onClick={() => nav.go('leaflets')}>{t('home.seeAll')} <ArrowRight size={14} /></button>
          </div>
          <div className="strip covers-strip">
            {leaflets.map(({ chain, l }) => <Cover key={l.url} chain={chain} l={l} compact />)}
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
          <div className="section-head"><h2>{t('watch.title')}</h2></div>
          <div className="rows">
            {watched.map((w) => {
              const p = products.find((x) => x.id === w.productId)
              if (!p) return null
              const c = cheapest(compare(p, pricesOf(p.id), retailers))
              const now = c?.current.priceCents ?? null
              const diff = now !== null && w.baselineCents !== null ? now - w.baselineCents : null
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
        </div>
      )}

      {insights.gaps.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('gap.title')}</h2>
            <span className="muted tiny">{t('gap.sub', { n: insights.compared })}</span>
          </div>
          <div className="rows">
            {insights.gaps.slice(0, gapsAll ? 10 : 3).map((g) => (
              <button key={g.product.id} className="row" onClick={() => nav.openProduct(g.product.id)}>
                <Tile product={g.product} />
                <div className="grow">
                  <div className="title">{g.product.name}</div>
                  <div className="sub">{t('gap.line', { low: g.low.retailer.name, high: g.high.retailer.name, price: euro(g.high.current.priceCents) })}</div>
                </div>
                <div className="end">
                  <div className="price" style={{ color: 'var(--accent)' }}>{euro(g.low.current.priceCents)}</div>
                  <div className="gap-save">−{Math.round(g.pct * 100)} %</div>
                </div>
              </button>
            ))}
          </div>
          {insights.gaps.length > 3 && (
            <button className="more-btn" onClick={() => setGapsAll((x) => !x)}>{gapsAll ? t('gap.less') : t('gap.moreShort')}</button>
          )}
        </div>
      )}


      {receipt && <ReceiptSheet onClose={() => setReceipt(false)} />}
    </div>
  )
}
