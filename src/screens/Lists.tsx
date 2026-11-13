import { getPendingQty, usePendingQty } from '../data/pendingQty'
import type { ReactNode } from 'react'
import { productById } from '../domain/productIndex'
import { useMemo, useState } from 'react'
import { Portal } from '../ui/Portal'
import { useStore } from '../data/store'
import { basketTotals, cheapest, compare, euro, sizeLabel, splitPlan } from '../domain/pricing'
import { useNav } from '../nav'
import { Check, List as ListIcon, Minus, Plus } from '../ui/icons'
import { RankBadge, RetailerMark, Tile } from '../ui/bits'
import { openProfilePage } from './Profile'
import { StoreMode } from './StoreMode'

export function Lists() {
  const {
    list, lists, setActiveList, createList, renameList, deleteList, restoreList,
    products, observations, retailers, setQuantity, toggleChecked, clearChecked, pricesOf, myStores, t,
  } = useStore()
  const nav = useNav()
  const [mode, setMode] = useState<'none' | 'new' | 'rename'>('none')
  const [name, setName] = useState('')
  const [toast, setToast] = useState('')
  const [undo, setUndo] = useState<typeof list | null>(null)
  const [shopping, setShopping] = useState(false)
  const [menu, setMenu] = useState(false)
  const display = (n: string) => (n === 'Weekly shop' ? t('list.defaultName') : n)

  const totals = useMemo(
    () => basketTotals(list, products, observations, retailers),
    [list, products, observations, retailers],
  )
  const plan = useMemo(() => splitPlan(list, products, pricesOf, retailers), [list, products, pricesOf, retailers])
  const complete = totals.filter((x) => x.missing === 0)
  const incomplete = totals.filter((x) => x.missing > 0)
  const best = complete[0]
  const itemCount = list.items.reduce((n, i) => n + i.quantity, 0)
  const items = [...list.items].sort((a, b) => Number(!!a.checked) - Number(!!b.checked))
  const ticked = list.items.filter((i) => i.checked).length
  // Splitting is worth an extra stop only when it saves at least 1,50 €.
  const worth = !!plan && (!plan.single || plan.savingCents >= 150)
  const dearest = complete[complete.length - 1]
  // No shop has everything: the one with the most of the list, then the cheapest.
  const partial = !best ? [...totals].filter((x) => x.missing < list.items.length).sort((a, b) => a.missing - b.missing || a.totalCents - b.totalCents)[0] : undefined

  const share = async () => {
    const lines = list.items.map((i) => {
      const p = productById(products, i.productId)
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
        <button className="icon-plain" onClick={() => setMenu(true)} aria-label={t('list.more')}>⋯</button>
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
      ) : null}

      {list.items.length > 0 && mode === 'none' && (best || plan || partial) && (
        <button className="plan-top" onClick={() => document.querySelector('.trip')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <span className="pt-label">{t('trip.top')}</span>
          {worth && plan ? (
            <>
              <span className="pt-stores">
                {plan.stores.map((r) => {
                  const picks = plan.picks.filter((p) => p.retailer.id === r.id)
                  return (
                    <span key={r.id} className="pt-store">
                      <RetailerMark retailer={r} />
                      <span className="pt-name">{r.name}</span>
                      <span className="pt-sub">{picks.length === 1 ? t('list.items1') : t('list.items', { n: picks.length })}</span>
                      <b>{euro(picks.reduce((n, p) => n + p.priceCents * p.quantity, 0))}</b>
                    </span>
                  )
                })}
              </span>
              <span className="pt-foot">
                <span>{t('trip.total')} <b>{euro(plan.totalCents)}</b></span>
                {plan.single && <span className="pt-save">−{euro(plan.savingCents)}</span>}
              </span>
            </>
          ) : best ? (
            <>
              <span className="pt-one">
                <RetailerMark retailer={best.retailer} />
                <span className="pt-name">{best.retailer.name}</span>
                <b>{euro(best.totalCents)}</b>
              </span>
              <span className="pt-foot">
                <span>{complete.length > 1 ? t('trip.cheapestOf', { n: complete.length }) : t('list.cheapest')}</span>
                {dearest && dearest !== best && <span className="pt-save">−{euro(dearest.totalCents - best.totalCents)}</span>}
              </span>
            </>
          ) : partial ? (
            <>
              <span className="pt-one">
                <RetailerMark retailer={partial.retailer} />
                <span className="pt-name">{partial.retailer.name}</span>
                <b>{euro(partial.totalCents)}</b>
              </span>
              <span className="pt-foot">
                <span>{t('trip.has', { n: list.items.length - partial.missing, of: list.items.length })}</span>
              </span>
            </>
          ) : null}
          {(worth || best) && <span className="pt-more">{t('trip.showSplit')} ↓</span>}
        </button>
      )}

      {list.items.length > 0 && mode === 'none' && (
        <button className="btn primary" style={{ marginTop: 12, height: 50 }} onClick={() => setShopping(true)}>
          {t('shop.start')}
        </button>
      )}

      {list.items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><ListIcon size={30} /></div>
          <div className="empty-title">{t('list.empty')}</div>
          <div className="empty-text">{t('list.emptyHint')}</div>
          <button className="btn primary" onClick={() => nav.go('search', { focus: true })}>{t('list.find')}</button>
        </div>
      ) : (
        <>
          <div className="rows section" style={{ marginTop: 12 }}>
            {items.map((item) => {
              const p = productById(products, item.productId)
              if (!p) return null
              const c = cheapest(compare(p, pricesOf(p.id), retailers))
              return (
                <ListRow key={p.id} id={p.id} checked={!!item.checked}>
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
                  <QtyStepper id={p.id} qty={item.quantity} setQuantity={setQuantity} less={t('list.less')} more={t('list.more')} />
                </ListRow>
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

          {(plan || best) && list.items.length >= 2 && (() => {
            const stores = worth && plan ? plan.stores : []
            return (
              <div className="section trip">
                <div className="section-head"><h2>{t('trip.title')}</h2></div>
                <div className="trip-compare">
                  {best && (
                    <div className={'trip-opt' + (!worth ? ' on' : '')}>
                      <span className="trip-k">{t('trip.oneStore')}</span>
                      <span className="trip-n">{best.retailer.name}</span>
                      <b>{euro(best.totalCents)}</b>
                    </div>
                  )}
                  {plan && (
                    <div className={'trip-opt' + (worth ? ' on' : '')}>
                      <span className="trip-k">{t('trip.twoStores')}</span>
                      <span className="trip-n">{plan.stores.map((r) => r.name).join(' + ')}</span>
                      <b>{euro(plan.totalCents)}</b>
                    </div>
                  )}
                </div>
                <div className="trip-verdict">
                  {worth && plan
                    ? (plan.single ? t('trip.split', { amount: euro(plan.savingCents) }) : t('split.noSingle'))
                    : best && t('trip.stay', { store: best.retailer.name }) + (plan ? ' ' + t('trip.only', { amount: euro(plan.savingCents) }) : '')}
                  {plan && plan.unpriced > 0 && <> {t('split.unpriced', { n: plan.unpriced })}</>}
                </div>
                {stores.map((r) => {
                  const picks = plan!.picks.filter((p) => p.retailer.id === r.id)
                  const sum = picks.reduce((n, p) => n + p.priceCents * p.quantity, 0)
                  return (
                    <div key={r.id} className="trip-store">
                      <div className="trip-store-head">
                        <RetailerMark retailer={r} />
                        <div className="grow">
                          <div className="title">{r.name}</div>
                          <div className="sub">{picks.length === 1 ? t('list.items1') : t('list.items', { n: picks.length })}</div>
                        </div>
                        <div className="price">{euro(sum)}</div>
                      </div>
                      <div className="rows">
                        {picks.map((pk) => {
                          const p = productById(products, pk.productId)
                          if (!p) return null
                          return (
                            <button key={pk.productId} className="row" onClick={() => nav.openProduct(p.id)}>
                              <Tile product={p} />
                              <div className="grow">
                                <div className="title">{pk.quantity > 1 ? `${pk.quantity} × ` : ''}{p.name}</div>
                                <div className="sub">{sizeLabel(p)}</div>
                              </div>
                              <div className="price">{euro(pk.priceCents * pk.quantity)}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {myStores.length === 0 && (
                  <button className="trip-tip" onClick={() => { openProfilePage('stores', nav.tab); nav.go('profile') }}>{t('trip.tip')}</button>
                )}
              </div>
            )
          })()}
        </>
      )}
      {shopping && <StoreMode onClose={() => setShopping(false)} />}
      {menu && (
        <Portal><div className="sheet-backdrop" onClick={() => setMenu(false)}>
          <div className="sheet menu-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <div className="rows">
              {list.items.length > 0 && <button className="row" onClick={() => { setMenu(false); share() }}>{t('list.share')}</button>}
              <button className="row" onClick={() => { setMenu(false); setMode('rename'); setName(display(list.name)) }}>{t('list.rename')}</button>
              {lists.length > 1 && (
                <button className="row danger" onClick={() => { setMenu(false); const gone = list; deleteList(list.id); setUndo(gone); setTimeout(() => setUndo((u) => (u === gone ? null : u)), 6000) }}>
                  {t('list.delete')}
                </button>
              )}
            </div>
          </div>
        </div></Portal>
      )}
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

// A list row. Hidden at once when its quantity is tapped down to zero, before
// the list itself has caught up.
function ListRow({ id, checked, children }: { id: string; checked: boolean; children: ReactNode }) {
  const pending = usePendingQty(id)
  if (pending === 0) return null
  return <div className="row" style={{ opacity: checked ? 0.45 : 1 }}>{children}</div>
}

// − n + : the number changes the moment a button is pressed.
function QtyStepper({ id, qty, setQuantity, less, more }: { id: string; qty: number; setQuantity: (id: string, q: number) => void; less: string; more: string }) {
  const pending = usePendingQty(id)
  const q = pending ?? qty
  return (
    <div className="stepper">
      <button onClick={() => setQuantity(id, (getPendingQty(id) ?? qty) - 1)} aria-label={less}><Minus size={16} /></button>
      <span><span className="n" key={q}>{q}</span></span>
      <button onClick={() => setQuantity(id, (getPendingQty(id) ?? qty) + 1)} aria-label={more}><Plus size={16} /></button>
    </div>
  )
}
