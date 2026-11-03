import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { basketTotals, cheapest, compare, euro, sizeLabel } from '../domain/pricing'
import { useNav } from '../nav'
import { Check, Minus, Plus } from '../ui/icons'
import { RankBadge, RetailerMark, Tile } from '../ui/bits'
import { StoreMode } from './StoreMode'

export function Lists() {
  const {
    list, lists, setActiveList, createList, renameList, deleteList, restoreList,
    products, observations, retailers, setQuantity, toggleChecked, clearChecked, t,
  } = useStore()
  const nav = useNav()
  const [mode, setMode] = useState<'none' | 'new' | 'rename'>('none')
  const [name, setName] = useState('')
  const [toast, setToast] = useState('')
  const [undo, setUndo] = useState<typeof list | null>(null)
  const [shopping, setShopping] = useState(false)
  const display = (n: string) => (n === 'Weekly shop' ? t('list.defaultName') : n)

  const totals = useMemo(
    () => basketTotals(list, products, observations, retailers),
    [list, products, observations, retailers],
  )
  const complete = totals.filter((x) => x.missing === 0)
  const incomplete = totals.filter((x) => x.missing > 0)
  const best = complete[0]
  const itemCount = list.items.reduce((n, i) => n + i.quantity, 0)
  const items = [...list.items].sort((a, b) => Number(!!a.checked) - Number(!!b.checked))
  const ticked = list.items.filter((i) => i.checked).length

  const share = async () => {
    const lines = list.items.map((i) => {
      const p = products.find((x) => x.id === i.productId)
      return `${i.checked ? '✓' : '•'} ${i.quantity > 1 ? `${i.quantity} × ` : ''}${p?.name ?? i.productId}`
    })
    const text = `${display(list.name)}\n${lines.join('\n')}`
    try {
      if (navigator.share) await navigator.share({ title: display(list.name), text })
      else {
        await navigator.clipboard.writeText(text)
        setToast(t('list.copied'))
        setTimeout(() => setToast(''), 2000)
      }
    } catch {
      /* the user closed the share sheet */
    }
  }

  const submit = () => {
    const n = name.trim()
    if (!n) return
    if (mode === 'new') createList(n)
    else renameList(list.id, n)
    setMode('none')
    setName('')
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h1 style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{display(list.name)}</h1>
        {list.items.length > 0 && <button className="link" onClick={share}>{t('list.share')}</button>}
      </div>

      <div className="chips">
        {lists.map((l) => (
          <button key={l.id} className={'chip' + (l.id === list.id ? ' on' : '')} onClick={() => { setActiveList(l.id); setMode('none') }}>
            {display(l.name)}
          </button>
        ))}
        <button className="chip" onClick={() => { setMode('new'); setName('') }}>+ {t('list.new')}</button>
      </div>

      {mode !== 'none' ? (
        <form className="section" style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); submit() }}>
          <label className="search" style={{ flex: 1 }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('list.newName')} />
          </label>
          <button className="btn primary" style={{ width: 'auto', padding: '0 18px', height: 48 }} type="submit">
            {t(mode === 'new' ? 'list.create' : 'list.save')}
          </button>
        </form>
      ) : (
        <div className="tiny" style={{ display: 'flex', gap: 16, margin: '10px 4px 0' }}>
          <button className="link" style={{ fontSize: 13 }} onClick={() => { setMode('rename'); setName(display(list.name)) }}>{t('list.rename')}</button>
          {lists.length > 1 && <button className="link" style={{ fontSize: 13 }} onClick={() => { const gone = list; deleteList(list.id); setUndo(gone); setTimeout(() => setUndo((u) => (u === gone ? null : u)), 6000) }}>{t('list.delete')}</button>}
        </div>
      )}

      {list.items.length > 0 && mode === 'none' && (
        <button className="btn primary" style={{ marginTop: 14, height: 50 }} onClick={() => setShopping(true)}>
          {t('shop.start')}
        </button>
      )}

      {list.items.length === 0 ? (
        <div className="empty">
          {t('list.empty')}
          <div style={{ marginTop: 16 }}>
            <button className="btn primary" style={{ maxWidth: 220 }} onClick={() => nav.go('search', { focus: true })}>{t('list.find')}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="rows section" style={{ marginTop: 12 }}>
            {items.map((item) => {
              const p = products.find((x) => x.id === item.productId)
              if (!p) return null
              const c = cheapest(compare(p, observations, retailers))
              return (
                <div key={p.id} className="row" style={{ opacity: item.checked ? 0.45 : 1 }}>
                  <button className={'tick' + (item.checked ? ' on' : '')} onClick={() => toggleChecked(p.id)} aria-label={t('list.tick')} aria-pressed={!!item.checked}>
                    {item.checked && <Check size={16} />}
                  </button>
                  <button className="grow" style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }} onClick={() => nav.openProduct(p.id)}>
                    <Tile product={p} />
                    <div style={{ minWidth: 0 }}>
                      <div className="title" style={{ textDecoration: item.checked ? 'line-through' : undefined }}>{p.name}</div>
                      <div className="sub">{[sizeLabel(p), c && t('list.from', { price: euro(c.current.priceCents) })].filter(Boolean).join(' · ')}</div>
                    </div>
                  </button>
                  <div className="stepper">
                    <button onClick={() => setQuantity(p.id, item.quantity - 1)} aria-label={t('list.less')}><Minus size={16} /></button>
                    <span>{item.quantity}</span>
                    <button onClick={() => setQuantity(p.id, item.quantity + 1)} aria-label={t('list.more')}><Plus size={16} /></button>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <button className="link" onClick={() => nav.go('search', { focus: true })}><Plus size={16} /> {t('list.add')}</button>
            {ticked > 0 && <button className="link" onClick={clearChecked}>{t('list.clearChecked')}</button>}
          </div>

          <div className="section">
            <div className="section-head">
              <h2>{t('list.where')}</h2>
              <span className="muted tiny">{itemCount === 1 ? t('list.items1') : t('list.items', { n: itemCount })}</span>
            </div>
            {complete.length === 0 && <p className="small muted" style={{ lineHeight: 1.5 }}>{t('list.noPrices')}</p>}
            <div className="rows">
              {complete.map((bt) => {
                const rank = complete.indexOf(bt) + 1
                const diff = best && rank > 1 ? bt.totalCents - best.totalCents : 0
                return (
                  <div key={bt.retailer.id} className="row">
                    <RankBadge rank={rank} />
                    <RetailerMark retailer={bt.retailer} />
                    <div className="grow">
                      <div className="title">{bt.retailer.name}</div>
                      <div className="sub">{rank === 1 ? t('list.cheapest') : `+${euro(diff)}`}</div>
                    </div>
                    <div className="end">
                      <div className="price" style={{ color: rank === 1 ? 'var(--accent)' : undefined }}>{euro(bt.totalCents)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            {complete.length > 0 && incomplete.length > 0 && (
              <p className="tiny muted" style={{ marginTop: 6 }}>
                {t('list.notRankedN', { n: incomplete.length })}
              </p>
            )}
          </div>
        </>
      )}
      {shopping && <StoreMode onClose={() => setShopping(false)} />}
      {toast && <div className="toast">{toast}</div>}
      {undo && (
        <div className="toast">
          {t('undo.listDeleted')}
          <button onClick={() => { restoreList(undo); setUndo(null) }}>{t('undo.undo')}</button>
        </div>
      )}
    </div>
  )
}
