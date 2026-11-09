import { useRef, useState } from 'react'
import { euro, type StoreSeries } from '../domain/pricing'
import { useStore } from '../data/store'
import { LOCALE } from '../i18n'

// Distinct colours; the cheapest shop today gets the app's green.
const COLORS = ['var(--accent)', '#2d6cdf', '#e3600b', '#8e44ad', '#c8202f', '#0aa2b5', '#b5871b', '#6b6b78']

/**
 * Price history for every shop that sells the product: one step line per shop.
 * Each day's price is drawn across the whole day, so a shop seen for one day
 * already has a line. Tap or drag to pick a day; the list shows each price that day.
 */
export function StoreChart({ dates, series }: { dates: Date[]; series: StoreSeries[] }) {
  const { lang } = useStore()
  const [sel, setSel] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const n = dates.length
  if (n < 1 || !series.length) return null
  // A price holds until the shop changes it: carry each shop's last price over
  // gaps and up to today, so every line runs to the right edge. Before a shop's
  // first price the line starts at the left edge too, dashed (not seen yet).
  const filled = series.map((ser) => {
    let last: number | null = null
    const solid = ser.values.map((v) => (v !== null ? (last = v) : last))
    const first = ser.values.find((v) => v !== null) ?? null
    const lead = ser.values.map((_, i) => (solid[i] === null ? first : null))
    return { ser, solid, lead }
  })

  const W = 340, H = 150, padX = 12, padTop = 14, padBottom = 26
  const all = filled.flatMap((f) => f.solid.filter((v): v is number => v !== null))
  const min = Math.min(...all), max = Math.max(...all)
  const span = Math.max(max - min, Math.max(20, max * 0.1))
  const lo = min - (span - (max - min)) / 2
  // day i covers [left(i), left(i + 1)]; points, ticks and the cursor sit in its middle
  const left = (i: number) => padX + (i / n) * (W - padX * 2)
  const x = (i: number) => (left(i) + left(i + 1)) / 2
  const y = (c: number) => padTop + (1 - (c - lo) / span) * (H - padTop - padBottom)
  // Shops with the same price on a day would draw one line over the other: on
  // those days their lines sit side by side, a few pixels apart, so each shows.
  const GAP = 3.2
  const shift = filled.map(() => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    const groups = new Map<number, number[]>()
    filled.forEach((f, k) => { const v = f.solid[i] ?? f.lead[i]; if (v !== null) groups.set(v, [...(groups.get(v) ?? []), k]) })
    for (const ks of groups.values()) if (ks.length > 1) ks.forEach((k, j) => { shift[k][i] = (j - (ks.length - 1) / 2) * GAP })
  }
  const path = (values: (number | null)[], off: number[]) => {
    let d = ''
    let prev: number | null = null
    values.forEach((v, i) => {
      if (v === null) { prev = null; return }
      const yy = (y(v) + off[i]).toFixed(1)
      d += prev === null ? ` M${left(i).toFixed(1)},${yy}` : ` V${yy}`
      d += ` H${left(i + 1).toFixed(1)}`
      prev = v
    })
    return d.trim()
  }
  const long = n > 60
  const fmt = (d: Date) => long ? d.toLocaleDateString(LOCALE[lang], { month: 'short' }).replace('.', '') : `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`
  const step = Math.max(1, Math.round((n - 1) / 4) || 1)
  const ticks = [...new Set([...Array.from({ length: Math.floor((n - 1) / step) + 1 }, (_, k) => k * step), n - 1])]
    .filter((i, k, arr) => k === arr.length - 1 || arr[arr.length - 1] - i >= step * 0.6)
  const s = sel ?? n - 1
  const pick = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const px = ((e.clientX - r.left) / r.width) * W
    setSel(Math.min(n - 1, Math.max(0, Math.floor(((px - padX) / (W - padX * 2)) * n))))
  }
  const rows = series
    .map((ser, k) => ({ ser, color: COLORS[k % COLORS.length], v: filled[k].solid[s] }))
    .sort((a, b) => (a.v ?? Infinity) - (b.v ?? Infinity))

  return (
    <div className="store-chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" onPointerDown={pick} onPointerMove={(e) => e.buttons && pick(e)} style={{ touchAction: 'pan-y', cursor: 'crosshair' }}>
        <line x1={x(s)} x2={x(s)} y1={padTop - 6} y2={H - padBottom} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="3 3" />
        {filled.map(({ ser, lead }, k) => lead.some((v) => v !== null) && (
          <path key={'l' + ser.retailer.id} d={path(lead, shift[k])} fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth={1.6} strokeDasharray="2 4" strokeLinecap="round" opacity={0.5} />
        ))}
        {filled.map(({ ser, solid }, k) => (
          <path key={ser.retailer.id} d={path(solid, shift[k])} fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth={k === 0 ? 2.6 : 2} strokeLinejoin="round" strokeLinecap="round" opacity={k === 0 ? 1 : 0.85} />
        ))}
        {filled.map(({ ser, solid }, k) => solid[s] !== null && (
          <circle key={ser.retailer.id} cx={x(s)} cy={y(solid[s]!) + shift[k][s]} r="4" fill={COLORS[k % COLORS.length]} stroke="var(--card)" strokeWidth="1.5" />
        ))}
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="11" fill="var(--text-2)" textAnchor="middle">{fmt(dates[i])}</text>
        ))}
      </svg>
      <div className="store-chart-day">{dates[s].toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'long' })}</div>
      <div className="store-chart-list">
        {rows.map(({ ser, color, v }) => (
          <div key={ser.retailer.id} className={'scl-row' + (v === null ? ' none' : '')}>
            <span className="scl-dot" style={{ background: color }} />
            <span className="scl-name">{ser.retailer.name}</span>
            <span className="scl-price">{v === null ? '–' : euro(v)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
