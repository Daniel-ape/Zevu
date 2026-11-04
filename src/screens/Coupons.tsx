import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useNav } from '../nav'
import { CARD_CHAINS, cardName, chainOf, guessFormat, type LoyaltyCard } from '../data/cards'
import { isActive, parseCoupon, type Coupon } from '../domain/coupons'
import { euro } from '../domain/pricing'
import { LOCALE } from '../i18n'
import { Sheet } from '../ui/Sheet'
import { Card as CardIcon, Plus, Ticket } from '../ui/icons'
import { CameraScanner } from './CameraScanner'
import { Cover, useShelf } from './Leaflets'

/**
 * Coupons: the user's loyalty cards (barcode shown at the till), coupons and
 * members' offers they photographed (read on the phone), and the leaflets of
 * the chains they have cards for. Everything stays on the phone.
 */
export function Coupons() {
  const { cards, coupons, removeCoupon, saveCoupon, t, lang } = useStore()
  const nav = useNav()
  const { shelf } = useShelf()
  const [showCard, setShowCard] = useState<LoyaltyCard | null>(null)
  const [addingCard, setAddingCard] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [filter, setFilter] = useState('all')
  const photo = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState('')

  const active = coupons.filter((c) => isActive(c) && !c.used)
  const chainsInUse = [...new Set(active.map((c) => c.chain))]
  const shown = active
    .filter((c) => filter === 'all' || c.chain === filter)
    .sort((a, b) => (a.validUntil ?? '9999').localeCompare(b.validUntil ?? '9999'))

  // Leaflets of the chains the user has cards for (that's where members' offers are printed).
  const myLeafletChains = new Set(cards.map((c) => chainOf(c).leaflets).filter(Boolean) as string[])
  const leaflets = shelf.filter((c) => myLeafletChains.has(c.chain)).flatMap((c) => c.leaflets.map((l) => ({ chain: c.chain, l }))).slice(0, 8)

  const onPhoto = async (f?: File) => {
    if (!f) return
    setReading(t('cp.reading'))
    try {
      const [{ photoToText }, image] = await Promise.all([import('../data/ocr'), shrink(f)])
      const text = await photoToText(f, (p) => setReading(t('rc.scanning', { p: Math.round(p * 100) })))
      setEditing({ id: crypto.randomUUID?.() ?? String(Date.now()), added: new Date().toISOString(), image, ...parseCoupon(text) })
    } catch {
      const image = await shrink(f).catch(() => undefined)
      setEditing({ id: String(Date.now()), added: new Date().toISOString(), image, chain: 'other', title: '', priceCents: null, percent: null, validUntil: null })
    } finally {
      setReading('')
      if (photo.current) photo.current.value = ''
    }
  }

  const fmtDate = (d: string) => new Date(d + 'T12:00').toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' })
  const daysLeft = (d: string) => Math.ceil((new Date(d + 'T23:59').getTime() - Date.now()) / 86_400_000)

  return (
    <div className="screen coupons">
      <div className="topbar"><h1>{t('cp.title')}</h1></div>

      {/* Loyalty cards */}
      <div className="section-head" style={{ marginTop: 4 }}><h2>{t('cp.cards')}</h2></div>
      <div className="strip card-strip">
        {cards.map((c) => (
          <button key={c.id} className="loyalty" style={{ background: chainOf(c).color }} onClick={() => setShowCard(c)}>
            <span className="loyalty-name">{cardName(c)}</span>
            <span className="loyalty-num">•••• {c.number.slice(-4)}</span>
          </button>
        ))}
        <button className="loyalty add" onClick={() => setAddingCard(true)}>
          <Plus size={22} />
          <span>{t('cp.addCard')}</span>
        </button>
      </div>

      {/* Coupons */}
      <div className="section">
        <div className="section-head">
          <h2>{t('cp.coupons')}</h2>
          <span className="muted tiny">{active.length ? t('cp.count', { n: active.length }) : ''}</span>
        </div>
        <button className="btn primary" onClick={() => photo.current?.click()} disabled={!!reading}>
          <Ticket size={20} /> {reading || t('cp.add')}
        </button>
        <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        <div className="group-note" style={{ marginBottom: 12 }}>{t('cp.addHint')}</div>

        {chainsInUse.length > 1 && (
          <div className="chips" style={{ marginBottom: 12 }}>
            <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>{t('offers.allChains')}</button>
            {chainsInUse.map((id) => (
              <button key={id} className={'chip' + (filter === id ? ' on' : '')} onClick={() => setFilter(id)}>{CARD_CHAINS.find((x) => x.id === id)?.name || t('cp.other')}</button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 24 }}>
            <div className="empty-icon"><Ticket size={30} /></div>
            <div className="empty-title">{t('cp.emptyTitle')}</div>
            <div className="empty-text">{t('cp.emptyText')}</div>
          </div>
        ) : (
          <div className="coupon-list">
            {shown.map((c) => {
              const chain = CARD_CHAINS.find((x) => x.id === c.chain)!
              const left = c.validUntil ? daysLeft(c.validUntil) : null
              return (
                <div key={c.id} className="coupon" style={{ ['--c' as string]: chain.color }}>
                  <button className="coupon-main" onClick={() => setEditing(c)}>
                    {c.image ? <img className="coupon-img" src={c.image} alt="" /> : <span className="coupon-img blank"><Ticket size={26} /></span>}
                    <span className="coupon-body">
                      <span className="coupon-chain">{chain.name || t('cp.other')}</span>
                      <span className="coupon-title">{c.title || t('cp.noTitle')}</span>
                      <span className="coupon-deal">
                        {c.priceCents !== null && <b>{euro(c.priceCents)}</b>}
                        {c.percent !== null && <i>−{c.percent} %</i>}
                      </span>
                      {c.validUntil && (
                        <span className={'coupon-valid' + (left !== null && left <= 2 ? ' soon' : '')}>
                          {left === 0 ? t('cp.lastDay') : left === 1 ? t('cp.tomorrow') : t('cp.until', { date: fmtDate(c.validUntil) })}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="coupon-actions">
                    {(() => {
                      const card = cards.find((k) => k.chain === c.chain)
                      return card ? <button className="coupon-card" onClick={() => setShowCard(card)}><CardIcon size={16} /> {t('cp.showCard')}</button> : null
                    })()}
                    <button className="coupon-used" onClick={() => saveCoupon({ ...c, used: true })}>{t('cp.used')}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Leaflets of the user's chains */}
      {leaflets.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2>{t('cp.leaflets')}</h2>
            <button className="link small" onClick={() => nav.go('leaflets')}>{t('home.seeAll')}</button>
          </div>
          <div className="strip covers-strip">
            {leaflets.map(({ chain, l }) => <Cover key={l.url} chain={chain} l={l} compact />)}
          </div>
          <div className="group-note">{t('cp.leafletHint')}</div>
        </div>
      )}

      {showCard && <CardView card={showCard} onClose={() => setShowCard(null)} />}
      {addingCard && <AddCard onClose={() => setAddingCard(false)} />}
      {editing && (
        <CouponEditor
          coupon={editing}
          isNew={!coupons.some((c) => c.id === editing.id)}
          onSave={(c) => { saveCoupon(c); setEditing(null) }}
          onDelete={() => { removeCoupon(editing.id); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/** A photo made small enough to keep on the phone (about 60–120 kB). */
async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 720 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.72)
}

/** Full-screen white card with the barcode, for the cashier's scanner. */
function CardView({ card, onClose }: { card: LoyaltyCard; onClose: () => void }) {
  const { removeCard, t } = useStore()
  const svg = useRef<SVGSVGElement>(null)
  const [qr, setQr] = useState('')
  useEffect(() => {
    const f = card.format
    if (/QR|AZTEC|DATA_MATRIX|PDF/.test(f)) {
      import('qrcode').then((Q) => Q.toDataURL(card.number, { margin: 1, width: 600, errorCorrectionLevel: 'M' })).then(setQr).catch(() => {})
      return
    }
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (!svg.current) return
      const format = f === 'EAN_13' ? 'EAN13' : f === 'EAN_8' ? 'EAN8' : f === 'CODE_39' ? 'CODE39' : f === 'ITF' ? 'ITF' : f === 'UPC_A' ? 'UPC' : f === 'CODABAR' ? 'codabar' : 'CODE128'
      try {
        JsBarcode(svg.current, card.number, { format, displayValue: false, margin: 0, height: 120, width: 2.4, background: '#ffffff', lineColor: '#000000' })
      } catch {
        JsBarcode(svg.current, card.number, { format: 'CODE128', displayValue: false, margin: 0, height: 120, width: 2.2 })
      }
    })
  }, [card])
  return (
    <div className="cardview" onClick={onClose} role="dialog" aria-label={cardName(card)}>
      <div className="cardview-inner" onClick={(e) => e.stopPropagation()}>
        <div className="cardview-head" style={{ background: chainOf(card).color }}>{cardName(card)}</div>
        <div className="cardview-code">
          {qr ? <img src={qr} alt="" style={{ width: '70%', maxWidth: 280 }} /> : <svg ref={svg} />}
          <div className="cardview-num">{card.number.replace(/(.{4})/g, '$1 ').trim()}</div>
        </div>
        <div className="cardview-hint">{t('cp.brightness')}</div>
        <div className="cardview-actions">
          <button className="btn ghost" onClick={() => { if (confirm(t('cp.removeCard'))) { removeCard(card.id); onClose() } }}>{t('cp.remove')}</button>
          <button className="btn primary" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  )
}

function AddCard({ onClose }: { onClose: () => void }) {
  const { addCard, t } = useStore()
  const [chain, setChain] = useState('s')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [format, setFormat] = useState('')
  const [camera, setCamera] = useState(false)
  const close = useCallback(onClose, [onClose])
  const ok = number.trim().length >= 4 && (chain !== 'other' || name.trim())
  return (
    <Sheet title={t('cp.addCard')} onClose={close} closeLabel={t('common.close')}>
      <div className="cat-grid" style={{ marginBottom: 14 }}>
        {CARD_CHAINS.map((c) => (
          <button key={c.id} className={'card-pick' + (chain === c.id ? ' on' : '')} style={{ ['--c' as string]: c.color }} onClick={() => setChain(c.id)}>
            <span className="card-swatch" />
            {c.name || t('cp.other')}
          </button>
        ))}
      </div>
      {chain === 'other' && (
        <label className="search" style={{ marginBottom: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('cp.cardName')} />
        </label>
      )}
      <button className="btn primary" onClick={() => setCamera(true)}><CardIcon size={20} /> {t('cp.scanCard')}</button>
      <div className="group-note" style={{ textAlign: 'center', margin: '10px 0' }}>{t('cp.orType')}</div>
      <label className="search">
        <input inputMode="numeric" value={number} onChange={(e) => { setNumber(e.target.value.replace(/\s/g, '')); setFormat('') }} placeholder={t('cp.cardNumber')} />
      </label>
      {format && <div className="group-note">{t('cp.scanned', { n: number })}</div>}
      <button className="btn primary" style={{ marginTop: 14 }} disabled={!ok} onClick={() => { addCard({ chain, name: chain === 'other' ? name.trim() : undefined, number: number.trim(), format: format || guessFormat(number.trim()) }); close() }}>
        {t('cp.saveCard')}
      </button>
      <div className="group-note">{t('cp.cardPrivacy')}</div>
      {camera && (
        <CameraScanner card onClose={() => setCamera(false)} onFallback={() => setCamera(false)} onCode={(code, f) => { setNumber(code); setFormat(f ?? ''); setCamera(false) }} />
      )}
    </Sheet>
  )
}

function CouponEditor({ coupon, isNew, onSave, onDelete, onClose }: {
  coupon: Coupon; isNew: boolean; onSave: (c: Coupon) => void; onDelete: () => void; onClose: () => void
}) {
  const { t } = useStore()
  const [c, setC] = useState(coupon)
  const [price, setPrice] = useState(coupon.priceCents !== null ? (coupon.priceCents / 100).toFixed(2).replace('.', ',') : '')
  const close = useCallback(onClose, [onClose])
  const cents = useMemo(() => { const v = parseFloat(price.replace(',', '.')); return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null }, [price])
  return (
    <Sheet title={isNew ? t('cp.check') : t('cp.edit')} onClose={close} closeLabel={t('common.close')}>
      {c.image && <img className="coupon-preview" src={c.image} alt="" />}
      <div className="group-body" style={{ marginTop: 10 }}>
        <div className="row"><span className="grow">{t('cp.chain')}</span>
          <select className="select" value={c.chain} onChange={(e) => setC({ ...c, chain: e.target.value })}>
            {CARD_CHAINS.map((x) => <option key={x.id} value={x.id}>{x.name || t('cp.other')}</option>)}
          </select>
        </div>
        <div className="row"><input className="coupon-input" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} placeholder={t('cp.titlePh')} /></div>
        <div className="row"><span className="grow">{t('cp.price')}</span>
          <input className="price-input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
        </div>
        <div className="row"><span className="grow">{t('cp.percent')}</span>
          <input className="price-input" inputMode="numeric" value={c.percent ?? ''} onChange={(e) => setC({ ...c, percent: e.target.value ? +e.target.value.replace(/\D/g, '') : null })} placeholder="–" />
        </div>
        <div className="row"><span className="grow">{t('cp.validUntil')}</span>
          <input className="select" type="date" value={c.validUntil ?? ''} onChange={(e) => setC({ ...c, validUntil: e.target.value || null })} />
        </div>
      </div>
      <button className="btn primary" style={{ marginTop: 14 }} onClick={() => onSave({ ...c, priceCents: cents, title: c.title.trim() })}>{t('cp.save')}</button>
      {!isNew && <button className="btn ghost" style={{ marginTop: 8 }} onClick={onDelete}>{t('cp.remove')}</button>}
    </Sheet>
  )
}
