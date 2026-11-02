import { useStore } from '../data/store'
import { inAppLink, isNativeApp } from '../data/openLink'
import type { Key } from '../i18n'
import { Chevron } from './icons'

// Official offer pages of each chain. They always show the current week, so
// nothing here goes out of date and no offer is ever invented by the app.
const CHAINS: { name: string; url: string; text: Key }[] = [
  { name: 'K-Ruoka', url: 'https://www.k-ruoka.fi/tarjouslehdet', text: 'offers.k' },
  { name: 'S-kaupat', url: 'https://www.s-kaupat.fi', text: 'offers.s' },
  { name: 'Lidl', url: 'https://www.lidl.fi', text: 'offers.lidl' },
  { name: 'Tokmanni', url: 'https://www.tokmanni.fi', text: 'offers.tok' },
]

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  return Math.ceil(((+t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7)
}

export function Offers() {
  const { t } = useStore()
  return (
    <div className="section">
      <div className="section-head">
        <h2>{t('offers.title')}</h2>
        <span className="muted tiny">{t('offers.week', { n: isoWeek() })}</span>
      </div>

      <div className="rows">
        {CHAINS.map((c) => (
          <a key={c.name} className="row" href={c.url} target="_blank" rel="noreferrer" onClick={inAppLink(c.url)} style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="mark" aria-hidden>{c.name[0]}</div>
            <div className="grow">
              <div className="title">{c.name}</div>
              <div className="sub" style={{ whiteSpace: 'normal' }}>{t(c.text)}</div>
            </div>
            <span className="muted"><Chevron /></span>
          </a>
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: 4, lineHeight: 1.5 }}>{t(isNativeApp ? 'offers.inAppNote' : 'offers.webNote')}</p>

    </div>
  )
}
