import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { euro } from '../domain/pricing'
import { retailerName } from '../domain/receipts'
import type { Key } from '../i18n'
import { LOCALE } from '../i18n'
import { Back, Chevron } from './icons'

/** Monthly food spending from the user's receipts: total, by store, by category. */
export function Spending() {
  const { receipts, products, allRetailers, t, lang } = useStore()
  const now = new Date()
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))

  const data = useMemo(() => {
    const inMonth = receipts.filter((r) => {
      const d = new Date(r.date)
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()
    })
    const byStore = new Map<string, number>()
    const byCat = new Map<string, number>()
    let total = 0
    for (const r of inMonth) {
      const sum = r.totalCents ?? r.items.reduce((s, i) => s + i.priceCents, 0)
      total += sum
      const store = retailerName(r, allRetailers)
      byStore.set(store, (byStore.get(store) ?? 0) + sum)
      for (const it of r.items) {
        const cat = products.find((p) => p.id === it.productId)?.category
        const key = cat ? `cat.${cat}` : 'spend.other'
        byCat.set(key, (byCat.get(key) ?? 0) + it.priceCents)
      }
    }
    const sorted = (m: Map<string, number>) => [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    return { count: inMonth.length, total, stores: sorted(byStore), cats: sorted(byCat) }
  }, [receipts, products, allRetailers, month])

  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth()
  const label = month.toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric' })

  const Bars = ({ rows, label: l }: { rows: [string, number][]; label: (k: string) => string }) => {
    const max = rows[0]?.[1] ?? 1
    return (
      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>{l(k)}</span><span style={{ fontWeight: 600 }}>{euro(v)}</span>
            </div>
            <div className="bar"><div style={{ width: `${(v / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="icon-btn" onClick={() => shift(-1)} aria-label={t('spend.prev')}><Back size={18} /></button>
        <div style={{ textAlign: 'center' }}>
          <div className="small muted" style={{ textTransform: 'capitalize' }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{euro(data.total)}</div>
          <div className="tiny muted">{data.count === 1 ? t('spend.receipt1') : t('spend.receipts', { n: data.count })}</div>
        </div>
        <button className="icon-btn" onClick={() => shift(1)} disabled={isCurrent} style={{ opacity: isCurrent ? 0.3 : 1 }} aria-label={t('spend.next')}><Chevron size={18} /></button>
      </div>
      {data.count === 0 ? (
        <p className="small muted" style={{ textAlign: 'center', lineHeight: 1.5 }}>{t('spend.none')}</p>
      ) : (
        <>
          <div className="small" style={{ fontWeight: 600, marginTop: 16 }}>{t('spend.byStore')}</div>
          <Bars rows={data.stores} label={(k) => k} />
          <div className="small" style={{ fontWeight: 600, marginTop: 18 }}>{t('spend.byCat')}</div>
          <Bars rows={data.cats} label={(k) => t(k as Key)} />
        </>
      )}
    </div>
  )
}
