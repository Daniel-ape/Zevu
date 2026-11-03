import { useEffect, useState } from 'react'
import { snapshotImage } from '../data/snapshot'
import type { CategoryId, Product, Retailer } from '../domain/types'
import type { RetailerPrice } from '../domain/pricing'
import { ageDays } from '../domain/pricing'
import { Arrow } from './icons'
import { useStore } from '../data/store'
import type { Key } from '../i18n'

export const CATEGORIES: { id: CategoryId | 'all'; key: Key }[] = (
  ['all', 'dairy', 'produce', 'bread', 'meat', 'pantry', 'drinks', 'snacks', 'household', 'health', 'pets', 'home', 'electronics', 'toys', 'clothing'] as const
).map((id) => ({ id, key: `cat.${id}` as Key }))

export function Tile({ product, large }: { product: Product; large?: boolean }) {
  const [broken, setBroken] = useState(false)
  const [packed, setPacked] = useState<string>()
  useEffect(() => {
    if (product.imageChunk === undefined) return
    let live = true
    snapshotImage(product.imageChunk, product.ean).then((src) => live && setPacked(src))
    return () => { live = false }
  }, [product.imageChunk, product.ean])
  const src = packed ?? product.imageUrl
  return (
    <div className={'tile' + (large ? ' lg' : '')} aria-hidden>
      {src && !broken ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : product.emoji}
    </div>
  )
}

export function RetailerMark({ retailer }: { retailer: Retailer }) {
  const initials = retailer.name.replace('-', ' ').split(' ').map((w) => w[0]).join('').slice(0, 2)
  return (
    <div className="mark" aria-hidden>
      {initials}
    </div>
  )
}

export function RankBadge({ rank }: { rank: number }) {
  if (rank !== 1) return <div className="rank">{rank}</div>
  return (
    <div className="badge-first" aria-label="Cheapest">1</div>
  )
}

export function TrendTag({ pct }: { pct: number | null }) {
  if (pct === null || Math.abs(pct) < 0.5) return null
  const down = pct < 0
  return (
    <span className={'tag ' + (down ? 'down' : 'up')}>
      <Arrow down={down} /> {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export function useUpdatedLabel() {
  const { t } = useStore()
  return (iso: string) => {
    const d = ageDays(iso)
    if (d < 1 / 24) return t('time.justNow')
    if (d < 1) return t('time.hours', { n: Math.round(d * 24) })
    if (d < 2) return t('time.yesterday')
    return t('time.days', { n: Math.floor(d) })
  }
}

export function PriceMeta({ row }: { row: RetailerPrice }) {
  const { t } = useStore()
  const when = useUpdatedLabel()(row.current.observedAt)
  const fresh = row.freshness === 'fresh'
  return (
    <>
      {fresh ? t('price.updated', { when }) : <span className="tag stale">{t('price.outdated', { when })}</span>}
      {row.current.source === 'user-report' && (
        <span className="tag receipt" style={{ marginLeft: 6 }}>{t(row.current.origin === 'receipt' || !row.current.origin ? 'price.receipt' : 'price.yours')}</span>
      )}
      {fresh && row.current.isMemberPrice && <span className="tag member" style={{ marginLeft: 6 }}>{t('price.member')}</span>}
      {fresh && !row.current.isMemberPrice && row.current.isPromotion && <span className="tag promo" style={{ marginLeft: 6 }}>{t('price.offer')}</span>}
    </>
  )
}
