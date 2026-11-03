import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { inAppLink } from '../data/openLink'
import { Chevron } from './icons'
import type { Key } from '../i18n'

// Shortcuts to the chains' own weekly leaflets. Lidl's leaflets change address
// every week, so a daily job (collector/leaflets.mjs) stores their current
// links; until it has run, the Lidl row opens Lidl's leaflet page instead.
// S Group has no nationwide leaflet, so it is not listed here.
type Leaflet = { chain: string; name?: string; period?: string; text?: Key; url: string }

const FIXED: Leaflet[] = [
  { chain: 'K-Ruoka', text: 'offers.k', url: 'https://www.k-ruoka.fi/tarjouslehdet' },
  { chain: 'Lidl', text: 'offers.lidl', url: 'https://www.lidl.fi/c/tarjouslehdet/s10019134' },
  { chain: 'Tokmanni', text: 'offers.tok', url: 'https://tarjoussanomat.tokmanni.fi/Tarjoussanomat/' },
]

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  return Math.ceil(((+t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7)
}

function useLidlLeaflets() {
  const [list, setList] = useState<Leaflet[]>([])
  useEffect(() => {
    fetch('./prices/leaflets.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { lidl?: { name: string; period: string; url: string }[] } | null) => {
        const rows = (d?.lidl ?? []).filter((l) => typeof l.url === 'string' && l.url.startsWith('https://www.lidl.fi/'))
        setList(rows.slice(0, 6).map((l) => ({ chain: 'Lidl', name: l.name, period: l.period, url: l.url })))
      })
      .catch(() => {})
  }, [])
  return list
}

export function Offers() {
  const { t } = useStore()
  const lidl = useLidlLeaflets()
  const rows = FIXED.flatMap((f) => (f.chain === 'Lidl' && lidl.length ? lidl : [f]))
  return (
    <div className="section">
      <div className="section-head">
        <h2>{t('offers.title')}</h2>
        <span className="muted tiny">{t('offers.week', { n: isoWeek() })}</span>
      </div>
      <div className="group-body leaflets">
        {rows.map((l) => (
          <a key={l.url} className="row" href={l.url} target="_blank" rel="noreferrer" onClick={inAppLink(l.url)}>
            <span className="mark" aria-hidden>{l.chain[0]}</span>
            <div className="grow">
              <div className="title">{l.name ? `${l.chain} · ${l.name}` : l.chain}</div>
              <div className="sub">{l.period ?? (l.text ? t(l.text) : '')}</div>
            </div>
            <span className="muted" aria-hidden><Chevron /></span>
          </a>
        ))}
      </div>
    </div>
  )
}
