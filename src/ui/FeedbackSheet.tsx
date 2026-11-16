import { useState } from 'react'
import { useStore } from '../data/store'
import { sendFeedback, type FeedbackKind } from '../data/feedback'
import { Sheet } from './Sheet'

/**
 * "Wrong price?" for a product, or general feedback from You. A few taps and an
 * optional note; sent without name or email.
 */
export function FeedbackSheet({ product, onClose }: { product?: { id: string; name: string }; onClose: () => void }) {
  const { t } = useStore()
  const kinds: { id: FeedbackKind; label: string }[] = [
    { id: 'price', label: t('fb.kPrice') },
    { id: 'picture', label: t('fb.kPicture') },
    { id: 'name', label: t('fb.kName') },
    { id: 'other', label: t('fb.kOther') },
  ]
  const [kind, setKind] = useState<FeedbackKind>(product ? 'price' : 'general')
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const canSend = state !== 'sending' && (product ? true : text.trim().length > 2)

  const send = async () => {
    setState('sending')
    try {
      await sendFeedback({ kind, message: text, productId: product?.id, productName: product?.name })
      setState('done')
      setTimeout(onClose, 1400)
    } catch {
      setState('failed')
    }
  }

  return (
    <Sheet title={product ? t('fb.title') : t('fb.generalTitle')} onClose={onClose} closeLabel={t('common.cancel')}>
      {state === 'done' ? (
        <div className="fb-done"><div className="fb-check">✓</div><p>{t('fb.thanks')}</p></div>
      ) : (
        <div className="fb">
          {product ? (
            <>
              <p className="fb-product">{product.name}</p>
              <div className="chips wrap">
                {kinds.map((k) => (
                  <button key={k.id} className={'chip' + (kind === k.id ? ' on' : '')} onClick={() => setKind(k.id)}>{k.label}</button>
                ))}
              </div>
            </>
          ) : (
            <p className="fb-hint">{t('fb.generalHint')}</p>
          )}
          <textarea className="textarea" rows={product ? 3 : 6} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={product ? t('fb.placeholder') : t('fb.generalPlaceholder')} />
          {state === 'failed' && <p className="fb-err">{t('fb.failed')}</p>}
          <button className="btn primary" disabled={!canSend} onClick={send}>{state === 'sending' ? t('fb.sending') : t('fb.sendBtn')}</button>
          <p className="fb-note">{t('fb.anon')}</p>
        </div>
      )}
    </Sheet>
  )
}
