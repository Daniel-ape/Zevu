import { useEffect, useState } from 'react'
import { distance, locate, nearestByChain, useNearby, type NearStore } from '../data/nearby'
import { isNativeApp, openInApp } from '../data/openLink'
import { useStore } from '../data/store'
import { clock, openStatus, parseHours } from '../domain/openingHours'
import { Store } from './icons'

/**
 * The nearest store of each chain, with how far it is and whether it is open
 * now (opening hours from OpenStreetMap). Tapping one opens it in the map app.
 */
export function NearbyStores() {
  const { t, lang } = useStore()
  const { stores, status } = useNearby()
  const [now, setNow] = useState(() => new Date())
  // "open until" changes as time passes while the page is open
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id) }, [])
  const [asking, setAsking] = useState(false)

  if (status === 'off') {
    return (
      <div className="near-off">
        <p>{t('nb.why')}</p>
        <button className="btn primary" disabled={asking} onClick={() => { setAsking(true); locate().catch(() => {}).finally(() => setAsking(false)) }}>{t('nb.show')}</button>
      </div>
    )
  }
  if (status === 'loading' || !stores) return <div className="near-off"><p>{status === 'error' ? t('nb.error') : t('nb.loading')}</p></div>

  const list = [...nearestByChain(stores).values()].sort((a, b) => a.km - b.km).slice(0, 8)
  if (!list.length) return <div className="near-off"><p>{t('nb.none')}</p></div>
  const days = lang === 'fi' ? ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'] : lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön']
  const state = (s: NearStore): { text: string; open?: boolean } | null => {
    const st = openStatus(parseHours(s.hours), now)
    if (!st) return null
    if (st.open) return { open: true, text: st.always ? t('nb.always') : t('nb.openUntil', { t: clock(st.until!) }) }
    if (st.opensIn === undefined) return { open: false, text: t('nb.closed') }
    const day = st.opensIn === 0 ? '' : st.opensIn === 1 ? t('nb.tomorrow') : days[(((now.getDay() + 6) % 7) + st.opensIn) % 7]
    return { open: false, text: t('nb.closedOpens', { when: [day, clock(st.at!)].filter(Boolean).join(' ') }) }
  }
  return (
    <div className="rows near-list">
      {list.map((s) => {
        const st = state(s)
        return (
          <button key={`${s.lat},${s.lon}`} className="row" onClick={() => { const u = mapUrl(s); if (isNativeApp) openInApp(u).catch(() => window.open(u, '_blank')); else window.open(u, '_blank') }}>
            <span className="near-ico" aria-hidden><Store size={18} /></span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="title">{s.name}</div>
              <div className="sub">
                {distance(s.km)}
                {st && <> · <span className={st.open ? 'near-open' : 'near-closed'}>{st.text}</span></>}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** The store in the phone's map app (Apple Maps on iPhone, Google Maps elsewhere). */
function mapUrl(s: NearStore) {
  const q = encodeURIComponent(s.name)
  return /iPhone|iPad|Macintosh/.test(navigator.userAgent)
    ? `https://maps.apple.com/?q=${q}&ll=${s.lat},${s.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`
}
