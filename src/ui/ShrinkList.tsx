import { useMemo } from 'react'
import { useStore } from '../data/store'
import { useShrinks } from '../data/shrink'
import { useNav } from '../nav'
import { Tile } from './bits'

const sizeText = (amount: number, unit: string) =>
  unit === 'pcs' ? `${amount} kpl` : amount >= 1000 ? `${(amount / 1000).toLocaleString('fi-FI')} ${unit === 'g' ? 'kg' : 'l'}` : `${amount} ${unit}`

/** Products that came in a smaller pack at a higher price per kilo or litre. */
export function ShrinkList() {
  const { products, t } = useStore()
  const nav = useNav()
  const shrinks = useShrinks()
  const byEan = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>()
    for (const p of products) if (p.ean && !m.has(p.ean)) m.set(p.ean, p)
    return m
  }, [products])
  if (!shrinks) return null
  const rows = shrinks.map((s) => ({ s, p: byEan.get(s[0]) })).filter((r) => r.p)
  return (
    <>
      <p className="group-note" style={{ marginTop: 0 }}>{t('shr.how')}</p>
      {rows.length === 0 ? <div className="empty">{t('shr.none')}</div> : (
        <div className="rows">
          {rows.map(({ s, p }) => {
            const [, , from, to, unit, , oldC, newC] = s
            const pct = Math.round(((newC / to) / (oldC / from) - 1) * 100)
            return (
              <button key={s[0]} className="row" onClick={() => nav.openProduct(p!.id)}>
                <Tile product={p!} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="title">{p!.name}</div>
                  <div className="sub">{sizeText(from, unit)} → {sizeText(to, unit)} · <span className="shr-up">+{pct} %</span> {t(`shr.per.${unit}` as 'shr.per.g')}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
