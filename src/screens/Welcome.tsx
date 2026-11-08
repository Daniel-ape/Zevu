import { useState } from 'react'
import { useStore } from '../data/store'
import { accountsEnabled, signInWithGoogle, takeSignInError } from '../data/account'
import { RETAILERS } from '../data/retailers'
import { RetailerMark } from '../ui/bits'

/** One shop line in the picture at the top: what the app shows for a product. */
const SAMPLE = [
  { id: 'lidl', price: '0,99' },
  { id: 'halpahalli', price: '1,09' },
  { id: 'tokmanni', price: '1,19' },
]

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}

/** First start: what the app is for, then sign in with Google or carry on without an account. */
export function Welcome({ onDone }: { onDone: () => void }) {
  const { t } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => (takeSignInError() ? t('acc.failed') : ''))
  const google = async () => {
    setBusy(true); setError('')
    try {
      await signInWithGoogle()
      onDone() // in the app the sign-in comes back here; on the web the page reloads signed in
    } catch {
      setError(t('acc.failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="welcome" role="dialog" aria-label={t('wel.title')}>
      <div className="welcome-hero" aria-hidden>
        <div className="wh-card">
          <div className="wh-product">
            <span className="wh-thumb">🥛</span>
            <div>
              <b>{t('wel.sampleName')}</b>
              <small>{t('wel.sampleSub')}</small>
            </div>
          </div>
          {SAMPLE.map((s, i) => {
            const r = RETAILERS.find((x) => x.id === s.id)
            return (
              <div key={s.id} className={'wh-row' + (i === 0 ? ' best' : '')}>
                {r && <RetailerMark retailer={r} />}
                <span className="wh-name">{r?.name ?? s.id}</span>
                {i === 0 && <span className="wh-chip">{t('product.cheapest')}</span>}
                <span className="wh-price">{s.price} €</span>
              </div>
            )
          })}
        </div>
        <div className="wh-save">
          <span>{t('wel.sampleSaved')}</span>
          <b>12,40 €</b>
        </div>
      </div>

      <div className="welcome-body">
        <div className="welcome-brand">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
          <span className="wb-name">ZEVU</span>
          <span className="wb-slogan">Compare More. Spend Less.</span>
        </div>
        <h1>{t('wel.headline')}</h1>
        <p>{t('wel.sub')}</p>
      </div>

      <div className="welcome-actions">
        {accountsEnabled && (
          <button className="welcome-btn google" onClick={google} disabled={busy}>
            <GoogleG />
            {busy ? t('acc.signingIn') : t('acc.google')}
          </button>
        )}
        <button className={'welcome-btn ' + (accountsEnabled ? 'plain' : 'primary')} onClick={onDone}>
          {accountsEnabled ? t('wel.skip') : t('wel.start')}
        </button>
        {error && <div className="error">{error}</div>}
        <p className="welcome-note">{accountsEnabled ? t('wel.note') : t('wel.noteLocal')}</p>
      </div>
    </div>
  )
}
