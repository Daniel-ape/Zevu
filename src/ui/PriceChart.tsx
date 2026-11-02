import { useState } from 'react'
import { euro } from '../domain/pricing'
import { useStore } from '../data/store'
import { LOCALE } from '../i18n'

interface Point { date: Date; cents: number }

/** Line chart of the lowest price over time; tap a point to inspect it. */
export function PriceChart({ points }: { points: Point[] }) {
  const [sel, setSel] = useState(points.length - 1)
  const { t, lang } = useStore()
  if (points.length < 2) return <div className="chart-wrap muted small" style={{ padding: 20 }}>{t('chart.notEnough')}</div>

  const W = 340, H = 170, padX = 14, padTop = 40, padBottom = 28
  const vals = points.map((p) => p.cents)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = Math.max(max - min, 20)
  const x = (i: number) => padX + (i / (points.length - 1)) * (W - padX * 2)
  const y = (c: number) => padTop + (1 - (c - min) / span) * (H - padTop - padBottom)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.cents).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1)},${H - padBottom} L${x(0)},${H - padBottom} Z`
  const months = points
    .map((p, i) => ({ i, m: p.date.toLocaleDateString(LOCALE[lang], { month: 'short' }).replace('.', '').toUpperCase() }))
    .filter((p, k, arr) => k === 0 || p.m !== arr[k - 1].m)
  const s = points[sel]

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Lowest price history">
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.10" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
        <line x1={x(sel)} x2={x(sel)} y1={y(s.cents)} y2={H - padBottom} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" />
        {points.map((p, i) => (
          <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
            <circle cx={x(i)} cy={y(p.cents)} r="14" fill="transparent" />
            {i === sel ? (
              <>
                <circle cx={x(i)} cy={y(p.cents)} r="10" fill="var(--accent)" opacity="0.18" />
                <circle cx={x(i)} cy={y(p.cents)} r="5.5" fill="var(--accent)" />
              </>
            ) : (
              null
            )}
          </g>
        ))}
        {months.map(({ i, m }) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="11" fill="var(--text-2)" textAnchor={i === 0 ? 'start' : 'middle'}>{m}</text>
        ))}
        {(() => {
          const label = euro(s.cents)
          const w = label.length * 7.4 + 18
          const cx = Math.min(Math.max(x(sel), w / 2 + 2), W - w / 2 - 2)
          const top = y(s.cents) - 38
          return (
            <g pointerEvents="none">
              <rect x={cx - w / 2} y={top} width={w} height="24" rx="9" fill="var(--lilac)" />
              <path d={`M${x(sel) - 5},${top + 24} L${x(sel)},${top + 29} L${x(sel) + 5},${top + 24} Z`} fill="var(--lilac)" />
              <text x={cx} y={top + 16} fontSize="12.5" fontWeight="600" fill="#fff" textAnchor="middle">{label}</text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}
