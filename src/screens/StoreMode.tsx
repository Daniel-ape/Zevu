import { useEffect } from 'react'
import { useStore } from '../data/store'
import type { CategoryId } from '../domain/types'
import { sizeLabel } from '../domain/pricing'
import { Check } from '../ui/icons'
import type { Key } from '../i18n'

// Shopping mode: the active list in store-walk order, big text, the whole row
// ticks an item, ticked items drop into "In the basket". Keeps the screen on
// where the browser allows it.
const AISLES: CategoryId[] = ['produce', 'bread', 'meat', 'dairy', 'pantry', 'snacks', 'drinks', 'household', 'health', 'pets', 'home', 'electronics', 'toys', 'clothing']

export function StoreMode({ onClose }: { onClose: () => void }) {
  const { list, products, toggleChecked, t } = useStore()

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => {})
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { lock?.release().catch(() => {}); document.body.style.overflow = prev }
  }, [])

  const rows = list.items
    .map((i) => ({ item: i, p: products.find((x) => x.id === i.productId) }))
    .filter((r): r is { item: typeof r.item; p: NonNullable<typeof r.p> } => !!r.p)
  const todo = rows.filter((r) => !r.item.checked)
  const done = rows.filter((r) => r.item.checked)
  const groups = AISLES.map((a) => ({ aisle: a, rows: todo.filter((r) => r.p.category === a) })).filter((g) => g.rows.length)

  const row = (r: (typeof rows)[number]) => (
    <button key={r.p.id} className={'shop-row' + (r.item.checked ? ' done' : '')} onClick={() => toggleChecked(r.p.id)} aria-pressed={!!r.item.checked}>
      <span className={'shop-tick' + (r.item.checked ? ' on' : '')}>{r.item.checked && <Check size={20} />}</span>
      <span className="shop-name">
        {r.item.quantity > 1 && <b>{r.item.quantity} × </b>}
        {r.p.name}
        {sizeLabel(r.p) && <small>{sizeLabel(r.p)}</small>}
      </span>
    </button>
  )

  return (
    <div className="shop" role="dialog" aria-modal="true" aria-label={t('shop.title')}>
      <div className="shop-head">
        <div>
          <div className="eyebrow">{t('shop.title')}</div>
          <div className="shop-count">{t('shop.progress', { done: done.length, all: rows.length })}</div>
        </div>
        <button className="btn primary shop-close" onClick={onClose}>{t('shop.done')}</button>
      </div>
      <div className="shop-bar"><span style={{ width: rows.length ? `${(done.length / rows.length) * 100}%` : 0 }} /></div>
      <div className="shop-body">
        {todo.length === 0 && rows.length > 0 && <div className="shop-all">✓ {t('shop.allDone')}</div>}
        {groups.map((g) => (
          <div key={g.aisle} className="shop-group">
            <div className="shop-aisle">{t(`cat.${g.aisle}` as Key)}</div>
            {g.rows.map(row)}
          </div>
        ))}
        {done.length > 0 && (
          <div className="shop-group">
            <div className="shop-aisle">{t('shop.inBasket')}</div>
            {done.map(row)}
          </div>
        )}
      </div>
    </div>
  )
}
