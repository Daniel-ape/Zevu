import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useNav } from '../nav'
import { CARD_CHAINS, cardName, chainOf, guessFormat, type LoyaltyCard } from '../data/cards'
import { isActive, parseCoupon, type Coupon } from '../domain/coupons'
import { euro } from '../domain/pricing'
import { LOCALE, type Key } from '../i18n'
import { Sheet } from '../ui/Sheet'
import { Card as CardIcon, Plus, Search as SearchIcon, Ticket } from '../ui/icons'
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

      <LeafletOffers onShowCard={setShowCard} />

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
                    {c.image ? <img className="coupon-img" src={c.image} alt="" /> : c.cut ? <Cut className="coupon-img" src={c.cut.src} box={c.cut.box} /> : <span className="coupon-img blank"><Ticket size={26} /></span>}
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

/** A part of a leaflet page: box = [left, top, width, height] as parts of the page, then page width/height. */
export function Cut({ src, box, className, onFail }: { src: string; box: number[]; className?: string; onFail?: () => void }) {
  const [x, y, w, h, pageAspect] = box
  const aspect = (w / h) * (pageAspect || 0.7)
  const ref = useRef<HTMLSpanElement>(null)
  const [show, setShow] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // Start loading when the frame comes near the screen. (The picture itself is a whole
  // page shifted out of view, so the browser's own lazy loading can skip it on iPhone.)
  useEffect(() => {
    const el = ref.current
    if (!el || show) return
    if (!('IntersectionObserver' in window)) { setShow(true); return }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setShow(true); io.disconnect() } }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [show])
  return (
    <span ref={ref} className={'cut ' + (loaded ? 'loaded ' : '') + (className ?? '')}>
      <span className="cut-frame" style={{ aspectRatio: String(aspect), ...(aspect >= 1 ? { width: '100%' } : { height: '100%' }) }}>
        {show && (
          <img src={src} alt="" decoding="async" onLoad={() => setLoaded(true)} onError={() => onFail?.()}
            style={{ width: `${100 / w}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }} />
        )}
      </span>
    </span>
  )
}

/** "Gäller bara med Lidl Plus-appen" etc. for an offer that needs a card or app. */
export function memberText(member: string, chain: string, t: (k: Key, v?: Record<string, string | number>) => string) {
  if (/lidl plus/i.test(member)) return t('cp.needApp')
  if (/plussa/i.test(member)) return t('cp.needPlussa')
  if (/s-etukortti/i.test(member)) return t('cp.needS')
  if (/kuponki/i.test(member)) return t('cp.needCoupon')
  const name = CARD_CHAINS.find((x) => x.id === chain)?.name || chain
  return t('cp.needCard', { chain: name })
}

export interface LeafletOffer {
  chain: string; leaflet: string; url: string; page: number; pageImage?: string | null
  name: string; details: string | null; priceCents: number; regularCents: number | null; percent: number | null
  crop?: number[] | null
  member: string | null; validFrom: string | null; validUntil: string | null
}
let offersFeed: Promise<{ offers: LeafletOffer[] } | null> | null = null
export const loadOffers = () => (offersFeed ??= import('../data/dataFile').then((m) => m.fetchData<{ offers: LeafletOffer[] }>('offers.json')))

/** Small store mark in the chain's colour, for the corner of an offer picture. */
export function ChainMark({ chain }: { chain: string }) {
  const c = CARD_CHAINS.find((x) => x.id === chain)
  const name = (c?.name || chain).replace(/ Plus$/, '').replace(/^K-Plussa$/, 'K').replace(/^S-Etukortti$/, 'S')
  return <span className="chain-mark" style={{ background: c?.color ?? '#6b6b78' }}>{name}</span>
}

/** Home page strip: members' offers from the leaflets, the user's own chains first. */
export function HomeMemberOffers() {
  const { cards, t } = useStore()
  const nav = useNav()
  const [all, setAll] = useState<LeafletOffer[] | null>(null)
  useEffect(() => { loadOffers().then((d) => setAll(d?.offers ?? [])) }, [])
  const today = new Date().toISOString().slice(0, 10)
  const mine = new Set(cards.map((c) => c.chain))
  const shown = (all ?? [])
    .filter((o) => o.member && (!o.validUntil || o.validUntil >= today) && (!o.validFrom || o.validFrom <= today))
    .sort((a, b) => Number(mine.has(b.chain)) - Number(mine.has(a.chain)) || (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 12)
  if (!shown.length) return null
  return (
    <div className="section">
      <div className="section-head">
        <h2>{t('cp.memberOffers')}</h2>
        <button className="link small" onClick={() => nav.go('coupons')}>{t('home.seeAll')}</button>
      </div>
      <div className="strip member-strip">
        {shown.map((o, i) => {
          const chain = CARD_CHAINS.find((x) => x.id === o.chain)
          return (
            <button key={i} className="member-card" style={{ ['--c' as string]: chain?.color ?? '#6b6b78' }} onClick={() => nav.go('coupons')}>
              <span className="member-pic">
                {o.crop && o.pageImage ? <Cut src={o.pageImage} box={o.crop} /> : <span className="offer-badge"><b>{o.percent ? `−${o.percent}%` : '%'}</b></span>}
                {o.percent ? <b className="offer-pct">−{o.percent}%</b> : null}
                <ChainMark chain={o.chain} />
              </span>
              <span className="member-name">{o.name}</span>
              <span className="member-price">{euro(o.priceCents)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Offers read from the shops' online leaflets (collector/offers.mjs). */
function LeafletOffers({ onShowCard }: { onShowCard: (c: LoyaltyCard) => void }) {
  const { cards, coupons, saveCoupon, t, lang } = useStore()
  const [all, setAll] = useState<LeafletOffer[] | null>(null)
  const myChains = useMemo(() => new Set(cards.map((c) => c.chain)), [cards])
  const [filter, setFilter] = useState<string>('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(20)
  const [big, setBig] = useState<LeafletOffer | null>(null)
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const fail = (u: string) => setFailed((f) => (f.has(u) ? f : new Set(f).add(u)))
  useEffect(() => { loadOffers().then((d) => setAll(d?.offers ?? [])) }, [])
  const today = new Date().toISOString().slice(0, 10)
  // only offers that need a loyalty card or app – the rest are ordinary leaflet prices
  const live = useMemo(() => (all ?? []).filter((o) => o.member && (!o.validUntil || o.validUntil >= today)), [all, today])
  const chains = [...new Set(live.map((o) => o.chain))]
  const mineAvailable = chains.some((c) => myChains.has(c))
  const f = filter || (mineAvailable ? 'mine' : 'all')
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = live
    .filter((o) => f === 'all' || (f === 'mine' ? myChains.has(o.chain) : o.chain === f))
    .filter((o) => words.every((w) => (o.name + ' ' + (o.details ?? '')).toLowerCase().includes(w)))
    // members' prices first, then the biggest discounts
    .sort((a, b) => Number(!!b.member && myChains.has(b.chain)) - Number(!!a.member && myChains.has(a.chain)) || (b.percent ?? 0) - (a.percent ?? 0))
  if (all === null || live.length === 0) return null
  const fmtDate = (d: string) => new Date(d + 'T12:00').toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' })
  const savedKey = (o: LeafletOffer) => `${o.chain}:${o.name}:${o.priceCents}`
  const isSaved = (o: LeafletOffer) => coupons.some((c) => c.id === 'lf:' + savedKey(o))
  const pageUrl = (o: LeafletOffer) => (/publitas|promozilla/.test(o.url) ? o.url.replace(/\/?$/, '/') + 'page/' + o.page : o.url)

  return (
    <div className="section">
      <div className="section-head"><h2>{t('cp.memberOffers')}</h2><span className="muted tiny">{shown.length}</span></div>
      <label className="search"><SearchIcon /><input type="search" placeholder={t('cp.offersSearch')} value={q} onChange={(e) => { setQ(e.target.value); setLimit(20) }} /></label>
      <div className="chips" style={{ margin: '10px 0 12px' }}>
        {mineAvailable && <button className={'chip' + (f === 'mine' ? ' on' : '')} onClick={() => setFilter('mine')}>{t('cp.offersMine')}</button>}
        <button className={'chip' + (f === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>{t('cp.offersAll')}</button>
        {chains.map((id) => (
          <button key={id} className={'chip' + (f === id ? ' on' : '')} onClick={() => setFilter(id)}>{CARD_CHAINS.find((x) => x.id === id)?.name.replace(' Plus', '') || id}</button>
        ))}
      </div>
      {shown.length === 0 ? <div className="group-note">{t('cp.offersNone')}</div> : (
        <div className="offer-list">
          {shown.slice(0, limit).map((o, i) => {
            const chain = CARD_CHAINS.find((x) => x.id === o.chain)
            const card = cards.find((k) => k.chain === o.chain)
            const saved = isSaved(o)
            return (
              <div key={i} className="offer-row" style={{ ['--c' as string]: chain?.color ?? '#6b6b78' }}>
                {o.crop && o.pageImage && !failed.has(o.pageImage) ? (
                  <button className="offer-pic" onClick={() => setBig(o)} aria-label={o.name}>
                    <Cut src={o.pageImage} box={o.crop} onFail={() => fail(o.pageImage!)} />
                    {o.percent ? <b className="offer-pct">−{o.percent}%</b> : null}
                    <ChainMark chain={o.chain} />
                  </button>
                ) : (
                  <a className="offer-badge" href={pageUrl(o)} target="_blank" rel="noreferrer" aria-label={t('cp.offerOpen')}>
                    {o.percent ? <b>−{o.percent}%</b> : <b>%</b>}
                    <small>{chain?.name.replace(' Plus', '') ?? o.chain}</small>
                  </a>
                )}
                <a className="offer-body" href={pageUrl(o)} target="_blank" rel="noreferrer">
                  <span className="offer-name">{o.name}</span>
                  {o.details && <span className="offer-details">{o.details}</span>}
                  <span className="offer-price">
                    <b>{euro(o.priceCents)}</b>
                    {o.regularCents && <s>{euro(o.regularCents)}</s>}
                  </span>
                  {o.validUntil && <span className="offer-valid">{t('cp.until', { date: fmtDate(o.validUntil) })}</span>}
                </a>
                <div className="offer-actions">
                  <button
                    className={'offer-save' + (saved ? ' on' : '')}
                    disabled={saved}
                    onClick={() => saveCoupon({ id: 'lf:' + savedKey(o), added: new Date().toISOString(), chain: chain ? o.chain : 'other', title: o.name, priceCents: o.priceCents, percent: o.percent, validUntil: o.validUntil, link: pageUrl(o), member: o.member, ...(o.crop && o.pageImage ? { cut: { src: o.pageImage, box: o.crop } } : {}) })}
                  >{saved ? t('cp.offerSaved') : t('cp.offerSave')}</button>
                  {card && o.member && <button className="offer-card" onClick={() => onShowCard(card)}><CardIcon size={15} /></button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {shown.length > limit && <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setLimit(limit + 30)}>{t('cp.offersMore', { n: shown.length - limit })}</button>}
      <div className="group-note">{t('cp.offersNote')}</div>
      {big && big.crop && big.pageImage && (
        <Sheet title={big.name} onClose={() => setBig(null)}>
          <div className="offer-big"><Cut src={big.pageImage} box={big.crop} /></div>
          <a className="btn primary" href={pageUrl(big)} target="_blank" rel="noreferrer" style={{ marginTop: 14 }}>{t('cp.offerOpen')}</a>
        </Sheet>
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
