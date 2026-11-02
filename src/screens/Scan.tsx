import { useRef, useState } from 'react'
import { ReceiptSheet } from './ReceiptSheet'
import { CameraScanner } from './CameraScanner'
import { PriceSheet } from './PriceSheet'
import { useStore } from '../data/store'
import { decodeImage } from '../data/barcode'
import { useNav } from '../nav'
import { Scan as ScanIcon } from '../ui/icons'

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
      </button>
      {status && <p className="small" style={{ textAlign: 'center', color: 'var(--text-2)', lineHeight: 1.5 }}>{status}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <button className="btn ghost" style={{ fontSize: 14 }} onClick={() => setShelf(true)}>{t('scan.shelf')}</button>
        <button className="btn ghost" style={{ fontSize: 14 }} onClick={() => setReceipt(true)}>{t('scan.receipt')}</button>
      </div>

      <form className="section" onSubmit={(e) => { e.preventDefault(); lookup(code) }}>
        <div className="small muted" style={{ marginBottom: 8 }}>{t('scan.type')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="search" style={{ flex: 1 }}>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setStatus('') }}
              inputMode="numeric"
              placeholder="6410000000000"
              aria-label={t('scan.label')}
            />
          </label>
          <button className="btn primary" style={{ width: 'auto', padding: '0 20px', height: 48 }} disabled={busy} type="submit">{t('scan.lookup')}</button>
        </div>
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
