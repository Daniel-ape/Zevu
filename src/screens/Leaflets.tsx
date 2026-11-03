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
type Status = 'now' | 'soon'
type Leaflet = { name: string; period?: string; url: string; image?: string; status?: Status }
type Chain = { chain: string; about: Key; leaflets: Leaflet[] }

const LIDL_PAGE = 'https://www.lidl.fi/c/tarjouslehdet/s10019134'
const TOK_PAGE = 'https://tarjoussanomat.tokmanni.fi/Tarjoussanomat/'
const IMG_HOSTS = ['https://imgproxy.leaflets.schwarz/', 'https://cdn.ipaper.io/', 'https://tarjoussanomat.tokmanni.fi/']
const safeImg = (u?: unknown) => (typeof u === 'string' && IMG_HOSTS.some((h) => u.startsWith(h)) ? u : undefined)

type Collected = {
  updated?: string
  lidl?: { name: string; period: string; url: string; image?: string }[] | null
  tokmanni?: { name: string; url: string; image?: string }[] | { image?: string } | null
}

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  return Math.ceil(((+t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7)
}

// Lidl periods look like "ma 2.11. – ke 4.11."; Tokmanni names carry the week
// ("Ruokasanomat vk 45 ma-ke"). Expired leaflets are hidden, current ones come
// first and upcoming ones are marked.
function periodStatus(period: string | undefined, now = new Date()): Status | 'past' | undefined {
  const m = period?.match(/(\d{1,2})\.(\d{1,2})\.[^\d]*(\d{1,2})\.(\d{1,2})\./)
  if (!m) return undefined
  const y = now.getFullYear()
  const date = (d: string, mo: string) => {
    const x = new Date(y, +mo - 1, +d)
    // Around new year the leaflet may belong to the next or previous year.
    if (+x - +now > 180 * 86_400_000) x.setFullYear(y - 1)
    if (+now - +x > 180 * 86_400_000) x.setFullYear(y + 1)
    return x
  }
  const start = date(m[1], m[2])
  const end = date(m[3], m[4])
  end.setHours(23, 59, 59)
  if (now > end) return 'past'
  return now >= start ? 'now' : 'soon'
}
function weekStatus(name: string): Status | 'past' | undefined {
  // Tokmanni's Tarjoussanomat link always opens the newest issue.
  if (/^tarjoussanomat$/i.test(name.trim())) return 'now'
  const m = name.match(/\bvk\.?\s*(\d{1,2})\b/i)
  if (!m) return undefined
  const w = +m[1]
  const cur = isoWeek()
  if (w === cur) return 'now'
  // Week numbers wrap at new year.
  const ahead = (w - cur + 53) % 53
  return ahead > 0 && ahead < 4 ? 'soon' : 'past'
}
const order = (l: Leaflet) => (l.status === 'now' ? 0 : l.status === 'soon' ? 2 : 1)

function useShelf(): { shelf: Chain[]; updated?: string } {
  const { t } = useStore()
  const [data, setData] = useState<Collected | null>(null)
  useEffect(() => {
    fetchData<Collected>('leaflets.json').then(setData)
  }, [])
  const week = t('offers.week', { n: isoWeek() })
  const lidl = (data?.lidl ?? [])
    .filter((l) => typeof l.url === 'string' && l.url.startsWith('https://www.lidl.fi/'))
    .slice(0, 9)
    .map((l) => ({ name: l.name, period: l.period, url: l.url, image: safeImg(l.image), status: periodStatus(l.period) }))
    .filter((l) => l.status !== 'past')
    .map((l) => ({ ...l, status: l.status as Status | undefined }))
    .sort((a, b) => order(a) - order(b))
  const tok = (Array.isArray(data?.tokmanni) ? data.tokmanni : [])
    .filter((l) => typeof l.url === 'string' && l.url.startsWith('https://tarjoussanomat.tokmanni.fi/'))
    .slice(0, 9)
    .map((l) => ({ name: l.name.replace(/^Lue uusin\s+/i, ''), url: l.url, image: safeImg(l.image), status: weekStatus(l.name) }))
    .filter((l) => l.status !== 'past')
    .map((l) => ({ ...l, status: l.status as Status | undefined }))
    .sort((a, b) => order(a) - order(b))
  const shelf: Chain[] = [
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
  return { shelf, updated: typeof data?.updated === 'string' ? data.updated : undefined }
}

function Cover({ chain, l }: { chain: string; l: Leaflet }) {
  const { t } = useStore()
  const [broken, setBroken] = useState(false)
  const [wide, setWide] = useState(false)
  return (
    <a className="cover" href={l.url} target="_blank" rel="noreferrer" onClick={inAppLink(l.url)}>
      <div className="cover-img">
        {l.status && <span className={'cover-badge ' + l.status}>{t(l.status === 'now' ? 'offers.now' : 'offers.soon')}</span>}
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
  const { t, lang } = useStore()
  const { shelf, updated } = useShelf()
  const [only, setOnly] = useState<string>('all')
  const shown = only === 'all' ? shelf : shelf.filter((c) => c.chain === only)
  const when = updated && !Number.isNaN(+new Date(updated))
    ? new Date(updated).toLocaleString(lang === 'sv' ? 'sv-FI' : lang === 'fi' ? 'fi-FI' : 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <div className="screen">
      <div className="topbar">
        <h1>{t('offers.title')}</h1>
        <span className="muted small">{t('offers.week', { n: isoWeek() })}</span>
      </div>
      <div className="chips" style={{ marginTop: 14 }}>
        {['all', ...shelf.map((c) => c.chain)].map((c) => (
          <button key={c} className={'chip' + (only === c ? ' on' : '')} onClick={() => setOnly(c)}>
            {c === 'all' ? t('offers.allChains') : c}
          </button>
        ))}
      </div>
      {shown.map((c) => (
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
      <p className="muted tiny" style={{ marginTop: 28, textAlign: 'center', lineHeight: 1.6 }}>
        {t('offers.note')}
        {when && <><br />{t('offers.updated', { time: when })}</>}
      </p>
    </div>
  )
}
