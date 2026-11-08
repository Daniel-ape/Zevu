import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { euro } from '../domain/pricing'
import { savingsReport } from '../domain/receipts'
import type { Key } from '../i18n'
import { LOCALE } from '../i18n'
import { useNav } from '../nav'
import { Back, Chevron } from './icons'

const first = (d: Date, n = 0) => new Date(d.getFullYear(), d.getMonth() + n, 1)

/**
 * Savings overview from the user's receipts: what a month saved compared with
 * the other shops, the best buys, where it would have been cheaper, the last
 * six months, and spending by store and category.
 */
export function Spending() {
  const { receipts, products, allRetailers, pricesOf, t, lang } = useStore()
  const nav = useNav()
  const now = new Date()
  const [month, setMonth] = useState(() => first(now))
  const nameOf = (id: string) => allRetailers.find((r) => r.id === id)?.name ?? id

  const report = useMemo(() => savingsReport(receipts, pricesOf, month), [receipts, pricesOf, month])
  const history = useMemo(
    () => [-5, -4, -3, -2, -1, 0].map((n) => {
      const m = first(month, n)
      const r = n === 0 ? report : savingsReport(receipts, pricesOf, m)
      return { m, saved: r.savedCents, spent: r.spentCents }
    }),
    [receipts, pricesOf, month, report],
  )
  const cats = useMemo(() => {
    const byCat = new Map<string, number>()
    for (const r of receipts) {
      const d = new Date(r.date)
      if (d.getFullYear() !== month.getFullYear() || d.getMonth() !== month.getMonth()) continue
      for (const it of r.items) {
        const cat = products.find((p) => p.id === it.productId)?.category
        const key = cat ? `cat.${cat}` : 'spend.other'
        byCat.set(key, (byCat.get(key) ?? 0) + it.priceCents)
      }
    }
    return [...byCat.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  }, [receipts, products, month])

  const best = [...report.lines].filter((l) => l.savedCents > 0).sort((a, b) => b.savedCents - a.savedCents).slice(0, 5)
  const missed = [...report.lines].filter((l) => l.missedCents > 0).sort((a, b) => b.missedCents - a.missedCents).slice(0, 5)
  const productName = (id: string, fallback: string) => products.find((p) => p.id === id)?.name ?? fallback

  const shift = (n: number) => setMonth((m) => first(m, n))
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth()
  const label = month.toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric' })
  const maxSaved = Math.max(1, ...history.map((h) => h.saved))

  if (receipts.length === 0) return <p className="small muted" style={{ padding: '16px 0', margin: 0, lineHeight: 1.5 }}>{t('spend.none')}</p>

  return (
    <div className="savings">
      <div className="sv-month">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label={t('spend.prev')}><Back size={18} /></button>
        <div className="sv-month-label">{label}</div>
        <button className="icon-btn" onClick={() => shift(1)} disabled={isCurrent} style={{ opacity: isCurrent ? 0.3 : 1 }} aria-label={t('spend.next')}><Chevron size={18} /></button>
      </div>

      <div className="sv-hero">
        <div className="sv-hero-label">{t('sv.saved')}</div>
        <div className="sv-hero-amount">{euro(report.savedCents)}</div>
        <div className="sv-hero-sub">{report.receipts === 1 ? t('spend.receipt1') : t('spend.receipts', { n: report.receipts })} · {t('sv.compared', { n: report.compared })}</div>
      </div>

      <div className="sv-stats">
        <div><span>{t('sv.spent')}</span><b>{euro(report.spentCents)}</b></div>
        <div><span>{t('sv.missed')}</span><b className={report.missedCents > 0 ? 'warn' : ''}>{euro(report.missedCents)}</b></div>
      </div>

      <div className="sv-section">{t('sv.sixMonths')}</div>
      <div className="sv-chart" role="img" aria-label={t('sv.sixMonths')}>
        {history.map((h) => {
          const cur = h.m.getTime() === month.getTime()
          return (
            <button key={h.m.toISOString()} className={'sv-col' + (cur ? ' on' : '')} onClick={() => setMonth(h.m)}>
              <span className="sv-val">{h.saved > 0 ? (h.saved >= 1000 ? euro(h.saved).replace(/,\d\d/, '') : euro(h.saved)) : ''}</span>
              <span className="sv-bar"><i style={{ height: `${Math.max(h.saved > 0 ? 6 : 2, (h.saved / maxSaved) * 100)}%` }} /></span>
              <span className="sv-mon">{h.m.toLocaleDateString(LOCALE[lang], { month: 'short' }).replace('.', '')}</span>
            </button>
          )
        })}
      </div>

      {report.receipts === 0 ? (
        <p className="small muted" style={{ textAlign: 'center', lineHeight: 1.5, marginTop: 20 }}>{t('sv.noneMonth')}</p>
      ) : (
        <>
          {best.length > 0 && (
            <>
              <div className="sv-section">{t('sv.best')}</div>
              <div className="sv-list">
                {best.map((l, i) => (
                  <button key={i} className="sv-line" onClick={() => nav.openProduct(l.productId)}>
                    <div className="grow">
                      <div className="sv-name">{productName(l.productId, l.name)}</div>
                      <div className="sv-sub">{l.storeName || nameOf(l.retailerId ?? '')} · {euro(l.paidCents)}</div>
                    </div>
                    <div className="sv-amt good">−{euro(l.savedCents)}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {missed.length > 0 && (
            <>
              <div className="sv-section">{t('sv.cheaperElsewhere')}</div>
              <div className="sv-list">
                {missed.map((l, i) => (
                  <button key={i} className="sv-line" onClick={() => nav.openProduct(l.productId)}>
                    <div className="grow">
                      <div className="sv-name">{productName(l.productId, l.name)}</div>
                      <div className="sv-sub">{t('sv.atStore', { store: nameOf(l.cheapestRetailerId), price: euro(l.cheapestCents) })}</div>
                    </div>
                    <div className="sv-amt warn">+{euro(l.missedCents)}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="sv-section">{t('spend.byStore')}</div>
          <div className="sv-list">
            {report.stores.map((s) => (
              <div key={s.retailerId ?? s.storeName} className="sv-line">
                <div className="grow">
                  <div className="sv-name">{s.retailerId ? nameOf(s.retailerId) : s.storeName || '—'}</div>
                  <div className="sv-sub">{s.receipts === 1 ? t('spend.receipt1') : t('spend.receipts', { n: s.receipts })}{s.savedCents > 0 ? ` · ${t('sv.savedShort', { amount: euro(s.savedCents) })}` : ''}</div>
                </div>
                <div className="sv-amt">{euro(s.spentCents)}</div>
              </div>
            ))}
          </div>

          {cats.length > 0 && (
            <>
              <div className="sv-section">{t('spend.byCat')}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {cats.map(([k, v]) => (
                  <div key={k}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                      <span>{t(k as Key)}</span><span style={{ fontWeight: 600 }}>{euro(v)}</span>
                    </div>
                    <div className="bar"><div style={{ width: `${(v / cats[0][1]) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="tiny muted" style={{ lineHeight: 1.5, marginTop: 18 }}>{t('sv.how')}</p>
        </>
      )}
    </div>
  )
}
