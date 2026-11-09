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
  const pctText = (Math.round(pct * 1000) / 10).toLocaleString(lang === 'en' ? 'en-GB' : 'fi-FI')
  // ring: the share of what the items cost elsewhere that was saved
  const R = 30, C = 2 * Math.PI * R
  const arc = report.spentCents > 0 ? Math.max(pct, pct > 0 ? 0.03 : 0) : 0
  return (
    <button className="sc sc2" onClick={onOpen}>
      <span className="sc2-glow" aria-hidden />
      <div className="sc-top">
        <span className="sc2-month"><i aria-hidden />{month.charAt(0).toUpperCase() + month.slice(1)}</span>
        <svg className="sc-chev" width="8" height="14" viewBox="0 0 8 14" aria-hidden><path d="M1.5 1.5 6.5 7l-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div className="sc2-hero">
        <div className="sc2-main">
          <span className="sc2-label">{t('sv.saved')}</span>
          <b className="sc2-amount">{euro(report.savedCents)}</b>
          <span className="sc2-sub">{report.spentCents > 0 ? t('save.pct', { pct: pctText }) : t('save.empty')}</span>
        </div>
        <svg className="sc2-ring" width="76" height="76" viewBox="0 0 76 76" aria-hidden>
          <defs><linearGradient id="scg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C4F83F" /><stop offset="1" stopColor="#12A05C" /></linearGradient></defs>
          <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(18,160,92,0.12)" strokeWidth="9" />
          <circle cx="38" cy="38" r={R} fill="none" stroke="url(#scg)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${arc * C} ${C}`} transform="rotate(-90 38 38)" />
          <text x="38" y="42" textAnchor="middle" className="sc2-ring-text">{report.spentCents > 0 ? `${pctText}%` : '–'}</text>
        </svg>
      </div>
      <div className="sc2-chips">
        <span><b>{euro(report.spentCents)}</b> {t('sv.spent').toLowerCase()}</span>
        <span><b>{report.receipts}</b> {t('save.receiptsWord').toLowerCase()}</span>
      </div>
    </button>
  )
}
