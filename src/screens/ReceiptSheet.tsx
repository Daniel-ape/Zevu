import { useRef, useState } from 'react'
import { useStore } from '../data/store'
import { euro } from '../domain/pricing'
import { matchProduct, parseReceipt, retailerName, type Receipt } from '../domain/receipts'
import { LOCALE } from '../i18n'

type Draft = Omit<Receipt, 'id' | 'importedAt'>

/** Bottom sheet: import a new receipt, or show a saved one. */
export function ReceiptSheet({ receipt, onClose }: { receipt?: Receipt; onClose: () => void }) {
  const { products, retailers, addReceipt, removeReceipt, t, lang } = useStore()
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<Draft | null>(receipt ?? null)
  const [busy, setBusy] = useState('')
  const [fromPhoto, setFromPhoto] = useState(false)
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const viewing = !!receipt

  const read = (raw: string) => {
    const parsed = parseReceipt(raw)
    if (!parsed.items.length) return setError(t('rc.noItems'))
    parsed.items = parsed.items.map((it) => ({ ...it, productId: matchProduct(it.name, products) }))
    setError('')
    setDraft(parsed)
  }

  const onFile = async (f?: File) => {
    if (!f) return
    setError('')
    const isPhoto = f.type.startsWith('image/') || /\.(jpe?g|png|heic|webp)$/i.test(f.name)
    setBusy(t(isPhoto ? 'rc.loadingOcr' : 'rc.reading'))
    try {
      if (isPhoto) {
        const { photoToText } = await import('../data/ocr')
        const text = await photoToText(f, (p) => setBusy(t('rc.scanning', { p: Math.round(p * 100) })))
        setFromPhoto(true)
        read(text)
      } else if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        const { pdfToText } = await import('../data/pdfText')
        read(await pdfToText(f))
      } else {
        read(await f.text())
      }
    } catch (e) {
      console.error(e)
      setError(t(isPhoto ? 'rc.ocrError' : 'rc.pdfError'))
    } finally {
      setBusy('')
      if (file.current) file.current.value = ''
      if (camera.current) camera.current.value = ''
    }
  }

  const save = () => {
    if (!draft) return
    if (!draft.retailerId) return setError(t('rc.needStore'))
    addReceipt({ ...draft, id: crypto.randomUUID?.() ?? String(Date.now()), importedAt: new Date().toISOString() })
    onClose()
  }

  const linked = draft ? draft.items.filter((i) => i.productId).length : 0
  const sum = draft ? draft.items.reduce((s, i) => s + i.priceCents, 0) : 0

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('rc.title')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="section-head" style={{ marginBottom: 16 }}>
          <h2>{viewing && draft ? retailerName(receipt!, retailers) : t('rc.title')}</h2>
          <button className="link" onClick={onClose}>{t(viewing ? 'rc.close' : 'rc.cancel')}</button>
        </div>

        {!draft && (
          <>
            <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <input ref={file} type="file" accept="application/pdf,.pdf,text/plain,.txt,image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <button className="btn primary" disabled={!!busy} onClick={() => camera.current?.click()}>
              {busy || t('rc.photo')}
            </button>
            <button className="btn ghost" style={{ marginTop: 10 }} disabled={!!busy} onClick={() => file.current?.click()}>
              {t('rc.file')}
            </button>
            <p className="tiny muted" style={{ lineHeight: 1.5 }}>{t('rc.photoTip')}</p>
            <div className="small muted" style={{ margin: '16px 0 8px' }}>{t('rc.paste')}</div>
            <textarea className="textarea" rows={7} value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn ghost" style={{ marginTop: 10 }} disabled={!text.trim()} onClick={() => read(text)}>
              {t('rc.read')}
            </button>
          </>
        )}

        {draft && (
          <>
            {!viewing && (
              <div className="rows">
                <label className="row">
                  <span className="grow title">{t('rc.store')}</span>
                  <select className="select" value={draft.retailerId ?? ''} onChange={(e) => setDraft({ ...draft, retailerId: e.target.value || null })}>
                    <option value="">{t('rc.chooseStore')}</option>
                    {retailers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
                <label className="row">
                  <span className="grow title">{t('rc.date')}</span>
                  <input
                    className="select"
                    type="date"
                    value={draft.date.slice(0, 10)}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => e.target.value && setDraft({ ...draft, date: new Date(e.target.value + 'T12:00').toISOString() })}
                  />
                </label>
              </div>
            )}
            {viewing && (
              <div className="small muted">{new Date(draft.date).toLocaleDateString(LOCALE[lang])}</div>
            )}

            <div className="small muted" style={{ margin: '18px 0 4px' }}>
              {t('rc.matched', { n: linked, m: draft.items.length })}
              {fromPhoto && !viewing && <>. {t('rc.check')}</>}
            </div>
            <div className="rows">
              {draft.items.map((it, i) => (
                <div key={i} className="row" style={{ padding: '10px 0' }}>
                  <div className="grow">
                    <div className="title" style={{ fontWeight: 500 }}>{it.quantity > 1 ? `${it.quantity} × ` : ''}{it.name}</div>
                    {!viewing ? (
                      <select
                        className="select inline"
                        value={it.productId ?? ''}
                        onChange={(e) => {
                          const items = draft.items.slice()
                          items[i] = { ...it, productId: e.target.value || undefined }
                          setDraft({ ...draft, items })
                        }}
                      >
                        <option value="">{t('rc.notLinked')}</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : (
                      <div className="sub">{products.find((p) => p.id === it.productId)?.name ?? t('rc.notLinked')}</div>
                    )}
                  </div>
                  <div className="price" style={{ fontSize: 15 }}>{euro(it.priceCents)}</div>
                </div>
              ))}
              <div className="row">
                <div className="grow title">{t('rc.total')}</div>
                <div className="price">{euro(draft.totalCents ?? sum)}</div>
              </div>
            </div>

            {viewing ? (
              <button className="btn ghost" style={{ marginTop: 16, color: 'var(--accent)' }} onClick={() => { removeReceipt(receipt!.id); onClose() }}>
                {t('rc.delete')}
              </button>
            ) : (
              <button className="btn primary" style={{ marginTop: 16 }} onClick={save}>{t('rc.save')}</button>
            )}
          </>
        )}

        {error && <div className="small" style={{ color: 'var(--accent)', marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  )
}
