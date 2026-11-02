import { useRef, useState } from 'react'
import { ReceiptSheet } from './ReceiptSheet'
import { CameraScanner } from './CameraScanner'
import { PriceSheet } from './PriceSheet'
import { useStore } from '../data/store'
import { decodeImage } from '../data/barcode'
import { useNav } from '../nav'
import { ArrowRight, Receipt, Scan as ScanIcon, Tag } from '../ui/icons'

export function Scan() {
  const { findByBarcode, t } = useStore()
  const nav = useNav()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [camera, setCamera] = useState(false)
  const [receipt, setReceipt] = useState(false)
  const [shelf, setShelf] = useState(false)
  const photo = useRef<HTMLInputElement>(null)

  const lookup = async (raw: string) => {
    const ean = raw.replace(/\D/g, '')
    if (ean.length < 8) return setStatus(t('scan.short'))
    setBusy(true)
    setStatus(t('scan.looking'))
    const res = await findByBarcode(ean)
    setBusy(false)
    if (res && res !== 'unavailable') { setStatus(''); nav.openProduct(res.id) }
    else setStatus(res === 'unavailable' ? t('scan.offline', { code: ean }) : t('scan.unknown', { code: ean }))
  }

  const fromPhoto = async (f?: File) => {
    if (!f) return
    setBusy(true)
    setStatus(t('scan.reading'))
    const found = await decodeImage(f).catch(() => null)
    if (photo.current) photo.current.value = ''
    if (found) lookup(found)
    else { setBusy(false); setStatus(t('scan.noBarcode')) }
  }

  return (
    <div className="screen">
      <div className="topbar"><h1>{t('scan.title')}</h1></div>

      <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={(e) => fromPhoto(e.target.files?.[0])} />
      <button className="scan-hero" disabled={busy} onClick={() => { setStatus(''); setCamera(true) }}>
        <ScanIcon size={34} />
        <span>{t('scan.barcode')}</span>
        <small>{t('scan.barcodeSub')}</small>
      </button>
      {status && <p className="small" style={{ textAlign: 'center', color: 'var(--text-2)', lineHeight: 1.5 }}>{status}</p>}

      <div className="scan-options">
        <button className="scan-option" onClick={() => setShelf(true)}>
          <Tag size={24} />
          <span>{t('scan.shelfShort')}</span>
          <small>{t('scan.shelfSub')}</small>
        </button>
        <button className="scan-option" onClick={() => setReceipt(true)}>
          <Receipt size={24} />
          <span>{t('scan.receiptShort')}</span>
          <small>{t('scan.receiptSub')}</small>
        </button>
      </div>

      <form className="section" onSubmit={(e) => { e.preventDefault(); lookup(code) }}>
        <label className="search" style={{ paddingRight: 6 }}>
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setStatus('') }}
            inputMode="numeric"
            placeholder={t('scan.type')}
            aria-label={t('scan.label')}
          />
          <button className="search-go" disabled={busy || code.replace(/\D/g, '').length < 8} type="submit" aria-label={t('scan.lookup')}><ArrowRight size={18} /></button>
        </label>
      </form>

      {camera && (
        <CameraScanner
          onCode={(c) => { setCamera(false); lookup(c) }}
          onClose={() => setCamera(false)}
          onFallback={() => { setCamera(false); setStatus(t('scan.noCamera')); photo.current?.click() }}
        />
      )}
      {receipt && <ReceiptSheet onClose={() => setReceipt(false)} />}
      {shelf && <PriceSheet startWithPhoto onClose={() => setShelf(false)} />}
    </div>
  )
}
