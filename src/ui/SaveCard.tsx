import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { euro } from '../domain/pricing'
import { savingsReport } from '../domain/receipts'
import { loadOffers } from '../screens/Coupons'
import { ArrowRight } from './icons'

/** Counts up to the value when it first shows or changes (skipped with reduced motion). */
function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(Math.round(a + (target - a) * e))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/** "5 min", "3 h", "2 d" */
function ago(ms: number, t: ReturnType<typeof useStore>['t']) {
  const m = Math.max(1, Math.round(ms / 60000))
  if (m < 60) return t('live.min', { n: m })
  const h = Math.round(m / 60)
  return h < 48 ? t('live.h', { n: h }) : t('live.d', { n: Math.round(h / 24) })
}

/**
 * The home page's savings card: this month's savings counting up, a line of how
 * they grew day by day, and live figures from the price data that take turns
 * (prices updated in the last day, this week's offers, the cheapest shop for
 * the list, when the data was last updated).
 */
export function SaveCard({ month, bestShop, onOpen }: { month: string; bestShop?: string; onOpen: () => void }) {
  const { receipts, pricesOf, observations, t } = useStore()
  const now = new Date()
  const report = useMemo(() => savingsReport(receipts, pricesOf, now), [receipts, pricesOf]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useCountUp(report.savedCents)

  // Saved so far on each day of the month, for the line.
  const days = now.getDate()
  const curve = useMemo(() => {
    const perDay = new Array(days).fill(0)
    for (const r of receipts) {
      const d = new Date(r.date)
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue
      perDay[Math.min(days, d.getDate()) - 1] += savingsReport([r], pricesOf, now).savedCents
    }
    let sum = 0
    return perDay.map((v) => (sum += v))
  }, [receipts, pricesOf, days]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live figures from the price data.
  const [offers, setOffers] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    const today = new Date().toISOString().slice(0, 10)
    loadOffers().then((d) => { if (live) setOffers((d?.offers ?? []).filter((o) => !o.validUntil || o.validUntil >= today).length) }).catch(() => {})
    return () => { live = false }
  }, [])
  const live = useMemo(() => {
    const dayAgo = Date.now() - 86_400_000
    let fresh = 0
    let latest = 0
    for (const o of observations) {
      if (o.source === 'user-report') continue
      const at = Date.parse(o.observedAt)
      if (at > dayAgo) fresh++
      if (at > latest) latest = at
    }
    return { fresh, latest }
  }, [observations])
  const facts = [
    live.fresh > 0 && { k: 'fresh', big: live.fresh.toLocaleString('fi-FI'), small: t('live.fresh') },
    offers ? { k: 'offers', big: String(offers), small: t('live.offers') } : null,
    bestShop && { k: 'best', big: bestShop, small: t('live.best') },
    live.latest > 0 && { k: 'updated', big: ago(Date.now() - live.latest, t), small: t('live.updated') },
  ].filter(Boolean) as { k: string; big: string; small: string }[]
  const [i, setI] = useState(0)
  useEffect(() => {
    if (facts.length < 2) return
    const id = setInterval(() => setI((x) => x + 1), 3600)
    return () => clearInterval(id)
  }, [facts.length])
  const fact = facts.length ? facts[i % facts.length] : null

  // The line: x over the days of the month, y up to this month's savings.
  const W = 300, H = 64
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const soFar = curve[curve.length - 1] ?? 0
  // At this month's pace so far, where the month would end (from day 3 on, so one receipt doesn't explode it).
  const projected = days >= 3 && soFar > 0 ? Math.round((soFar / days) * monthDays) : 0
  const total = Math.max(1, soFar, projected)
  const pts = curve.map((v, d) => [((d + 0.5) / monthDays) * W, H - 6 - (v / total) * (H - 14)] as const)
  const line = pts.length ? 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') : ''
  const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z` : ''
  const end = pts[pts.length - 1]

  return (
    <div className="zcard">
      <div className="zc-top">
        <span className="zc-label">{t('save.title', { month })}</span>
        <span className="zc-live"><i />LIVE</span>
      </div>
      <div className="zc-amount">{euro(shown)}</div>
      <div className="zc-sub">
        {report.receipts === 0
          ? t('save.empty')
          : <>{t(report.receipts === 1 ? 'save.receipts1' : 'save.receipts', { n: report.receipts })} · {t('save.spent', { amount: euro(report.spentCents) })}</>}
      </div>

      <svg className="zc-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="zcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C4F83F" stopOpacity="0.45" />
            <stop offset="1" stopColor="#C4F83F" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} className="zc-base" />
        {report.savedCents > 0 ? (
          <>
            <path d={area} fill="url(#zcFill)" />
            <path d={line} className="zc-line" pathLength={1} />
            {end && projected > soFar && (
              <path d={`M${end[0].toFixed(1)} ${end[1].toFixed(1)} L${W} ${(H - 6 - (projected / total) * (H - 14)).toFixed(1)}`} className="zc-proj" />
            )}
            {end && <circle cx={end[0]} cy={end[1]} r="4" className="zc-dot" />}
          </>
        ) : (
          <path d={`M0 ${H - 8} C ${W * 0.3} ${H - 10}, ${W * 0.6} ${H - 26}, ${W} ${H - 40}`} className="zc-ghost" />
        )}
      </svg>

      {projected > soFar && <div className="zc-proj-label">{t('live.pace', { amount: euro(projected) })}</div>}

      {fact && (
        <div className="zc-fact" key={fact.k + (i % facts.length)}>
          <b>{fact.big}</b>
          <span>{fact.small}</span>
          {facts.length > 1 && (
            <span className="zc-dots" aria-hidden>{facts.map((f, n) => <i key={f.k} className={n === i % facts.length ? 'on' : ''} />)}</span>
          )}
        </div>
      )}

      <div className="zc-actions">
        <button className="zc-btn main" onClick={onOpen}>{t('sv.open')} <ArrowRight size={15} /></button>
      </div>
    </div>
  )
}
