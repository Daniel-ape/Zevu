import { useMemo } from 'react'
import { useStore } from '../data/store'
import { euro } from '../domain/pricing'
import { savingsReport } from '../domain/receipts'

/**
 * The home page's savings card: this month's savings, what was paid and how
 * many receipts, and a bar of how big a share was saved (the whole bar is what
 * the same items cost on average in other shops). Tapping opens the overview.
 */
export function SaveCard({ month, onOpen }: { month: string; bestShop?: string; onOpen: () => void }) {
  const { receipts, pricesOf, t, lang } = useStore()
  const report = useMemo(() => savingsReport(receipts, pricesOf, new Date()), [receipts, pricesOf])
  const saved = Math.max(0, report.savedCents)
  const whole = report.spentCents + saved
  const pct = whole > 0 ? saved / whole : 0
  return (
    <button className="sc" onClick={onOpen}>
      <div className="sc-top">
        <span>{month.charAt(0).toUpperCase() + month.slice(1)}</span>
        <svg className="sc-chev" width="8" height="14" viewBox="0 0 8 14" aria-hidden><path d="M1.5 1.5 6.5 7l-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div className="sc-stats">
        <div><b>{euro(report.savedCents)}</b><span>{t('sv.saved')}</span></div>
        <div><b>{euro(report.spentCents)}</b><span>{t('sv.spent')}</span></div>
        <div><b>{report.receipts}</b><span>{t('save.receiptsWord')}</span></div>
      </div>
      {report.spentCents > 0 ? (
        <div className="sc-bar-wrap">
          <div className="sc-bar" aria-hidden>
            <i className="paid" style={{ width: `${(1 - pct) * 100}%` }} />
            <i className="saved" style={{ width: `${Math.max(pct * 100, pct > 0 ? 3 : 0)}%` }} />
          </div>
          <div className="sc-bar-label">{t('save.pct', { pct: (Math.round(pct * 1000) / 10).toLocaleString(lang === 'en' ? 'en-GB' : 'fi-FI') })}</div>
        </div>
      ) : (
        <div className="sc-bar-label">{t('save.empty')}</div>
      )}
    </button>
  )
}
