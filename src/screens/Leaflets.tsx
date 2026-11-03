import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { inAppLink } from '../data/openLink'
import { fetchData } from '../data/dataFile'
import type { Key } from '../i18n'

// A shelf of the chains' own weekly leaflets. Covers and links come from the
// chains' sites (collected daily by collector/leaflets.mjs); the leaflets
// themselves open on those sites, nothing is copied into the app.
// S Group has no nationwide leaflet (each regional cooperative makes its own,
// and Osuuskauppa KPO does not publish its weekly ads online), so S stores are
// not listed.
type Leaflet = { name: string; period?: string; url: string; image?: string }
type Chain = { chain: string; about: Key; leaflets: Leaflet[] }

const LIDL_PAGE = 'https://www.lidl.fi/c/tarjouslehdet/s10019134'
const TOK_PAGE = 'https://tarjoussanomat.tokmanni.fi/Tarjoussanomat/'
const IMG_HOSTS = ['https://imgproxy.leaflets.schwarz/', 'https://cdn.ipaper.io/', 'https://tarjoussanomat.tokmanni.fi/']
const safeImg = (u?: unknown) => (typeof u === 'string' && IMG_HOSTS.some((h) => u.startsWith(h)) ? u : undefined)

type Collected = {
  lidl?: { name: string; period: string; url: string; image?: string }[] | null
  tokmanni?: { name: string; url: string; image?: string }[] | { image?: string } | null
}

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  return Math.ceil(((+t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7)
}

function useShelf(): Chain[] {
  const { t } = useStore()
  const [data, setData] = useState<Collected | null>(null)
  useEffect(() => {
    fetchData<Collected>('leaflets.json').then(setData)
  }, [])
  const week = t('offers.week', { n: isoWeek() })
  const lidl = (data?.lidl ?? [])
    .filter((l) => typeof l.url === 'string' && l.url.startsWith('https://www.lidl.fi/'))
    .slice(0, 9)
    .map((l) => ({ name: l.name, period: l.period, url: l.url, image: safeImg(l.image) }))
  const tok = (Array.isArray(data?.tokmanni) ? data.tokmanni : [])
    .filter((l) => typeof l.url === 'string' && l.url.startsWith('https://tarjoussanomat.tokmanni.fi/'))
    .slice(0, 9)
    .map((l) => ({ name: l.name, url: l.url, image: safeImg(l.image) }))
  return [
    {
      chain: 'Lidl', about: 'offers.lidl',
      leaflets: lidl.length ? lidl : [{ name: t('offers.all'), url: LIDL_PAGE }],
    },
    {
      chain: 'Tokmanni', about: 'offers.tok',
      leaflets: tok.length ? tok : [{ name: 'Tarjoussanomat', period: week, url: TOK_PAGE }],
    },
    {
      chain: 'K-Ruoka', about: 'offers.kAbout',
      leaflets: [
        { name: 'K-Citymarket', period: week, url: 'https://www.k-ruoka.fi/k-citymarket/tarjouslehti' },
        { name: 'K-Supermarket', period: week, url: 'https://www.k-ruoka.fi/k-supermarket/tarjouslehti' },
        { name: 'K-Market', period: week, url: 'https://www.k-ruoka.fi/k-market/tarjouslehti' },
      ],
    },
  ]
}

function Cover({ chain, l }: { chain: string; l: Leaflet }) {
  const { t } = useStore()
  const [broken, setBroken] = useState(false)
  const [wide, setWide] = useState(false)
  return (
    <a className="cover" href={l.url} target="_blank" rel="noreferrer" onClick={inAppLink(l.url)}>
      <div className="cover-img">
        {l.image && !broken ? (
          <img
            src={l.image} alt="" loading="lazy" referrerPolicy="no-referrer" className={wide ? 'wide' : undefined}
            onLoad={(e) => setWide(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight)}
            onError={() => setBroken(true)}
          />
        ) : (
          <span className={'cover-blank c-' + chain.toLowerCase().replace(/[^a-z]/g, '')} aria-hidden>
            <b>{l.name.startsWith('K-') ? l.name : chain}</b>
            <small>{t('offers.leaflet')}</small>
          </span>
        )}
      </div>
      <div className="cover-name">{l.name}</div>
      {l.period && <div className="cover-period">{l.period}</div>}
    </a>
  )
}

export function Leaflets() {
  const { t } = useStore()
  const shelf = useShelf()
  return (
    <div className="screen">
      <div className="topbar">
        <h1>{t('offers.title')}</h1>
        <span className="muted small">{t('offers.week', { n: isoWeek() })}</span>
      </div>
      {shelf.map((c) => (
        <div key={c.chain} className="section">
          <div className="section-head">
            <h2>{c.chain}</h2>
            <span className="muted tiny">{t(c.about)}</span>
          </div>
          <div className="shelf">
            {c.leaflets.map((l) => <Cover key={l.url} chain={c.chain} l={l} />)}
          </div>
        </div>
      ))}
      <p className="muted tiny" style={{ marginTop: 28, textAlign: 'center' }}>{t('offers.note')}</p>
    </div>
  )
}
