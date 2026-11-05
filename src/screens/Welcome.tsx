import { useState } from 'react'
import { useStore } from '../data/store'
import { accountsEnabled, signInWithGoogle } from '../data/account'
import { Card as CardIcon, Paper, Scan } from '../ui/icons'

/** First start: what the app does, and sign in with Google (or carry on without an account). */
export function Welcome({ onDone }: { onDone: () => void }) {
  const { t } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
      <div className="welcome-top">
        <img className="welcome-icon" src={`${import.meta.env.BASE_URL}icons/maskable-512.png`} alt="" />
        <h1>Hintaopas</h1>
        <p className="welcome-tag">{t('wel.tagline')}</p>
      </div>
      <ul className="welcome-points">
        <li><span className="wp-icon"><Scan size={22} /></span><div><b>{t('wel.p1')}</b><small>{t('wel.p1s')}</small></div></li>
        <li><span className="wp-icon"><Paper size={22} /></span><div><b>{t('wel.p2')}</b><small>{t('wel.p2s')}</small></div></li>
        <li><span className="wp-icon"><CardIcon size={22} /></span><div><b>{t('wel.p3')}</b><small>{t('wel.p3s')}</small></div></li>
      </ul>
      <div className="welcome-actions">
        {accountsEnabled && (
          <button className="btn google" onClick={google} disabled={busy}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
              <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z" />
            </svg>
            {busy ? t('acc.signingIn') : t('acc.google')}
          </button>
        )}
        <button className="btn ghost" onClick={onDone}>{t('wel.skip')}</button>
        {error && <div className="error">{error}</div>}
        <p className="welcome-note">{accountsEnabled ? t('wel.note') : t('wel.noteLocal')}</p>
      </div>
    </div>
  )
}
