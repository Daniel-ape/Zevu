import { useRef, useState } from 'react'
import { euro } from '../domain/pricing'
import { useStore } from '../data/store'
import { LOCALE } from '../i18n'

interface Point { date: Date; cents: number }

/**
 * Lowest price per day as a step line (prices stay until they change).
 * Drag or tap anywhere on the chart to read the price on a given day.
 */
export function PriceChart({ points }: { points: Point[] }) {
  const [sel, setSel] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const { t, lang } = useStore()
  if (points.length < 2) return <div className="chart-wrap muted small" style={{ padding: 20 }}>{t('chart.notEnough')}</div>

  const W = 340, H = 170, padX = 14, padTop = 40, padBottom = 28
  const n = points.length
  const vals = points.map((p) => p.cents)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = Math.max(max - min, Math.max(20, max * 0.1))
  const lo = min - (span - (max - min)) / 2
  const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2)
  const y = (c: number) => padTop + (1 - (c - lo) / span) * (H - padTop - padBottom)
  let line = `M${x(0).toFixed(1)},${y(points[0].cents).toFixed(1)}`
  for (let i = 1; i < n; i++) line += ` H${x(i).toFixed(1)} V${y(points[i].cents).toFixed(1)}`
  const area = `${line} L${x(n - 1)},${H - padBottom} L${x(0)},${H - padBottom} Z`

  // About five date labels, as day.month for short ranges, month names for long ones.
  const long = n > 60
  const fmt = (d: Date) => long
    ? d.toLocaleDateString(LOCALE[lang], { month: 'short' }).replace('.', '').toUpperCase()
    : `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`
  const step = Math.max(1, Math.round((n - 1) / 4))
  const ticks = [...new Set([...Array.from({ length: Math.floor((n - 1) / step) + 1 }, (_, k) => k * step), n - 1])]
    .filter((i, k, arr) => k === arr.length - 1 || arr[arr.length - 1] - i >= step * 0.6)

  const s = sel ?? n - 1
  const pick = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const px = ((e.clientX - r.left) / r.width) * W
    setSel(Math.min(n - 1, Math.max(0, Math.round(((px - padX) / (W - padX * 2)) * (n - 1)))))
  }
  const label = euro(points[s].cents)
  const day = points[s].date.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' })
  const w = Math.max(label.length, day.length) * 6.6 + 20
  const cx = Math.min(Math.max(x(s), w / 2 + 2), W - w / 2 - 2)
  const top = Math.max(2, y(points[s].cents) - 44)

  return (
    <div className="chart-wrap">
      <svg
        ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('product.history')}
        onPointerDown={pick} onPointerMove={(e) => e.buttons && pick(e)} style={{ touchAction: 'pan-y', cursor: 'crosshair' }}
      >
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padX} x2={W - padX} y1={y(min)} y2={y(min)} stroke="var(--line)" strokeDasharray="2 4" />
        <path d={area} fill="url(#fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
        <line x1={x(s)} x2={x(s)} y1={y(points[s].cents)} y2={H - padBottom} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx={x(s)} cy={y(points[s].cents)} r="10" fill="var(--accent)" opacity="0.18" />
        <circle cx={x(s)} cy={y(points[s].cents)} r="5" fill="var(--accent)" />
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="11" fill="var(--text-2)" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{fmt(points[i].date)}</text>
        ))}
        <g pointerEvents="none">
          <rect x={cx - w / 2} y={top} width={w} height="34" rx="10" fill="var(--text)" />
          <text x={cx} y={top + 15} fontSize="12.5" fontWeight="700" fill="var(--bg)" textAnchor="middle">{label}</text>
          <text x={cx} y={top + 28} fontSize="10" fill="var(--bg)" opacity="0.75" textAnchor="middle">{day}</text>
        </g>
      </svg>
    </div>
  )
}
