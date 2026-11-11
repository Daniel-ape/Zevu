// "Share these prices with everyone": under a scanned receipt, an optional
// step that sends its prices to Open Prices (see data/openPrices.ts).
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { CHAIN_LABEL, distance, locate, useNearby, type Chain } from '../data/nearby'
import { openPricesLogin, openPricesLogout, signInOpenPrices, type OsmPlace } from '../data/openPrices'
import { inAppLink } from '../data/openLink'

export type ShareChoice = { on: boolean; place: OsmPlace | null }

const SIGNUP = 'https://world.openfoodfacts.org/cgi/user.pl'

export function ShareReceipt({ retailerId, count, value, onChange }: { retailerId: string | null; count: number; value: ShareChoice; onChange: (v: ShareChoice) => void }) {
  const { t } = useStore()
  const [login, setLogin] = useState(openPricesLogin)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const near = useNearby()
  useEffect(() => {
    const on = () => setLogin(openPricesLogin())
    addEventListener('zevu:openprices', on)
    return () => removeEventListener('zevu:openprices', on)
  }, [])

  const chain = retailerId && retailerId in CHAIN_LABEL ? (retailerId as Chain) : null
  const stores = useMemo(() => (near.stores ?? []).filter((s) => s.osm && (!chain || s.chain === chain)).slice(0, 8), [near.stores, chain])
  // the nearest shop of the receipt's chain, until the user picks another
  useEffect(() => {
    if (value.on && !value.place && stores[0]?.osm) onChange({ ...value, place: stores[0].osm })
  }, [value, stores, onChange])

  if (!count) return null
  const signIn = async () => {
    setBusy(true); setErr('')
    try { await signInOpenPrices(user, pass); setPass('') } catch (e) { setErr(t((e as Error).message === 'wrong' ? 'op.wrong' : 'op.offline')) }
    setBusy(false)
  }

  return (
    <div className="op-box">
      <label className="op-head">
        <input type="checkbox" checked={value.on} onChange={(e) => onChange({ ...value, on: e.target.checked })} />
        <span>
          <b>{t('op.title', { n: count })}</b>
          <small>{t('op.why')}</small>
        </span>
      </label>
      {value.on && (
        <div className="op-body">
          {!login ? (
            <>
              <p className="tiny muted">{t('op.signinWhy')}</p>
              <input className="textarea op-input" placeholder={t('op.user')} autoCapitalize="none" autoCorrect="off" value={user} onChange={(e) => setUser(e.target.value)} />
              <input className="textarea op-input" placeholder={t('op.pass')} type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
              <button className="btn primary" disabled={busy || !user.trim() || !pass} onClick={signIn}>{busy ? t('op.signingIn') : t('op.signin')}</button>
              {err && <div className="small" style={{ color: 'var(--accent)' }}>{err}</div>}
              <a className="link small" href={SIGNUP} target="_blank" rel="noreferrer" onClick={inAppLink(SIGNUP)}>{t('op.signup')}</a>
            </>
          ) : (
            <>
              <div className="tiny muted">{t('op.as', { user: login.user })} · <button className="link tiny" onClick={openPricesLogout}>{t('op.signout')}</button></div>
              <label className="row" style={{ padding: '10px 0' }}>
                <span className="grow title">{t('op.shop')}</span>
                {stores.length ? (
                  <select className="select" value={value.place ? `${value.place.type}:${value.place.id}` : ''} onChange={(e) => { const s = stores.find((x) => `${x.osm!.type}:${x.osm!.id}` === e.target.value); onChange({ ...value, place: s?.osm ?? null }) }}>
                    {stores.map((s) => <option key={`${s.osm!.type}:${s.osm!.id}`} value={`${s.osm!.type}:${s.osm!.id}`}>{s.name} · {distance(s.km)}</option>)}
                  </select>
                ) : near.status === 'loading' ? (
                  <span className="small muted">{t('op.finding')}</span>
                ) : (
                  <button className="btn ghost small" style={{ width: 'auto' }} onClick={() => locate().catch(() => setErr(t('op.noPlace')))}>{t('op.usePlace')}</button>
                )}
              </label>
              <p className="tiny muted" style={{ lineHeight: 1.5 }}>{t('op.check')} {t('op.public')}</p>
              {err && <div className="small" style={{ color: 'var(--accent)' }}>{err}</div>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
