import { useStore } from '../data/store'
import { inAppLink } from '../data/openLink'
import { Chevron } from './icons'
import type { Key } from '../i18n'

// Official weekly leaflet pages of each chain. They always show the current
// leaflet, so nothing here goes out of date and no offer is invented by the app.
// S Group has no nationwide leaflet, so it is not listed here.
const LEAFLETS: { name: string; url: string; text: Key }[] = [
  { name: 'K-Ruoka', url: 'https://www.k-ruoka.fi/tarjouslehdet', text: 'offers.k' },
  { name: 'Lidl', url: 'https://www.lidl.fi/c/tarjouslehdet/s10019134', text: 'offers.lidl' },
  { name: 'Tokmanni', url: 'https://www.tokmanni.fi/tarjouslehti', text: 'offers.tok' },
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
      <div className="group-body leaflets">
        {LEAFLETS.map((c) => (
          <a key={c.name} className="row" href={c.url} target="_blank" rel="noreferrer" onClick={inAppLink(c.url)}>
            <span className="mark" aria-hidden>{c.name[0]}</span>
            <div className="grow">
              <div className="title">{c.name}</div>
              <div className="sub">{t(c.text)}</div>
            </div>
            <span className="muted" aria-hidden><Chevron /></span>
          </a>
        ))}
      </div>
    </div>
  )
}
