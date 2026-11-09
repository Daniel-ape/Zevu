import { useEffect, useMemo, useRef, useState } from 'react'
import { Portal } from '../ui/Portal'
import { openCamera } from '../data/takePhoto'
import { useStore } from '../data/store'
import { decodeImage, isValidEan } from '../data/barcode'
import { pickShelfPrice, type LabelWord } from '../domain/shelfLabel'

const eanFromWords = (words: LabelWord[]) =>
  words.map((w) => w.text.replace(/\D/g, '')).find((d) => (d.length === 13 || d.length === 8) && isValidEan(d)) ?? null
import type { Product } from '../domain/types'
import { euro, sizeLabel, brandLabel } from '../domain/pricing'
import { Tile } from '../ui/bits'
import { Check } from '../ui/icons'

/**
 * Add a price the user saw: photograph a shelf label (barcode + price are
 * read on the phone) or pick the product and type the price.
 */
export function PriceSheet({ product: initial, startWithPhoto, store: initialStore, onClose }: {
  product?: Product
  startWithPhoto?: boolean
  /** Preselect this store (e.g. "add the price at S-market" on a product page). */
  store?: string
  onClose: () => void
}) {
  const { products, allRetailers, findByBarcode, addPrice, lastStore, t } = useStore()
  const [product, setProduct] = useState<Product | undefined>(initial)
  const [query, setQuery] = useState('')
  const [store, setStore] = useState(initialStore ?? lastStore ?? '')
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [fromShelf, setFromShelf] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const photo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (startWithPhoto) openCamera(photo.current, fromPhoto, (m) => setNote(`(${m})`))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return products.filter((p) => `${p.name} ${p.brand} ${p.ean}`.toLowerCase().includes(q)).slice(0, 6)
  }, [query, products])

  const fromPhoto = async (f?: File) => {
    if (!f) return
    setNote('')
    setBusy(t('ap.reading'))
    let ocrFail = ''
    try {
      const [decoded, words] = await Promise.all([
        decodeImage(f).catch(() => null),
        import('../data/ocr').then((m) => m.photoToWords(f)).catch((e) => { ocrFail = String(e?.message ?? e).slice(0, 140); return [] }),
      ])
      // The digits printed under the barcode work too when the bars can't be read.
      const code = decoded ?? eanFromWords(words)
      const cents = pickShelfPrice(words)
      if (cents) setPrice((cents / 100).toFixed(2).replace('.', ','))
      const notes: string[] = []
      if (code) {
        const found = await findByBarcode(code)
        if (found && found !== 'unavailable') setProduct(found)
        else notes.push(t('ap.unknown', { code }))
      } else if (!product) notes.push(t('ap.noBarcode'))
      if (!cents) notes.push(t('ap.noPrice'))
      notes.push(t('ap.check'))
      if (ocrFail) notes.push(`(${ocrFail})`)
      setFromShelf(true)
      setNote(notes.join(' '))
    } finally {
      setBusy('')
      if (photo.current) photo.current.value = ''
    }
  }

  const cents = Math.round(parseFloat(price.replace(',', '.').replace(/[^\d.]/g, '')) * 100)
  const valid = !!product && !!store && cents > 0 && cents < 100000

  const save = () => {
    if (!valid || !product) return
    addPrice({ productId: product.id, retailerId: store, priceCents: cents, origin: fromShelf ? 'shelf' : 'manual' })
    setSaved(`${product.name} · ${euro(cents)}`)
  }

  const again = () => {
    setSaved(null); setProduct(undefined); setPrice(''); setQuery(''); setNote(''); setFromShelf(false)
    openCamera(photo.current, fromPhoto, (m) => setNote(`(${m})`))
  }

  return (
    <Portal><div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('ap.title')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="section-head" style={{ marginBottom: 14 }}>
          <h2>{t('ap.title')}</h2>
          <button className="link" onClick={onClose}>{t('rc.close')}</button>
        </div>
        <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={(e) => fromPhoto(e.target.files?.[0])} />

        {saved ? (
          <div style={{ textAlign: 'center', padding: '18px 0 4px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--good)', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}><Check size={28} /></div>
            <div className="title" style={{ fontWeight: 700 }}>{t('ap.saved')}</div>
            <div className="small muted" style={{ marginTop: 4 }}>{saved}</div>
            <button className="btn primary" style={{ marginTop: 18 }} onClick={again}>{t('ap.another')}</button>
          </div>
        ) : (
          <>
            {!product && (
              <>
                <button className="btn primary" disabled={!!busy} onClick={() => openCamera(photo.current, fromPhoto, (m) => setNote(`(${m})`))}>{busy || t('ap.shelf')}</button>
                <p className="tiny muted" style={{ lineHeight: 1.5 }}>{t('ap.tip')}</p>
                <div className="small muted" style={{ margin: '14px 0 8px' }}>{t('ap.or')}</div>
                <label className="search"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('ap.search')} /></label>
                <div className="rows">
                  {matches.map((p) => (
                    <button key={p.id} className="row" onClick={() => setProduct(p)}>
                      <Tile product={p} />
                      <div className="grow"><div className="title">{p.name}</div><div className="sub">{[brandLabel(p.brand), sizeLabel(p)].filter(Boolean).join(' · ')}</div></div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {product && (
              <>
                <div className="row" style={{ borderBottom: 0, paddingTop: 0 }}>
                  <Tile product={product} />
                  <div className="grow"><div className="title">{product.name}</div><div className="sub">{[brandLabel(product.brand), sizeLabel(product)].filter(Boolean).join(' · ')}</div></div>
                  {!initial && <button className="link" onClick={() => setProduct(undefined)}>{t('ap.change')}</button>}
                </div>
                <div className="rows">
                  <label className="row">
                    <span className="grow title">{t('ap.store')}</span>
                    <select className="select" value={store} onChange={(e) => setStore(e.target.value)}>
                      <option value="">{t('rc.chooseStore')}</option>
                      {allRetailers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </label>
                  <label className="row">
                    <span className="grow title">{t('ap.price')}</span>
                    <input className="select price-input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
                  </label>
                </div>
                {busy && <p className="small muted">{busy}</p>}
                <button className="btn primary" style={{ marginTop: 14 }} disabled={!valid} onClick={save}>{t('ap.save')}</button>
              </>
            )}
            {note && <p className="small" style={{ color: 'var(--text-2)', lineHeight: 1.5, marginTop: 12 }}>{note}</p>}
          </>
        )}
      </div>
    </div></Portal>
  )
}
