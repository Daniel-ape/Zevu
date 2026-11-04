import { useEffect, useState } from 'react'
import { ChainMark } from '../ui/ChainMark'
import { useStore } from '../data/store'
import { inAppLink } from '../data/openLink'
import { loadLeaflets, markLeafletsSeen, type LeafletFeed } from '../data/leafletFeed'
import { CHAIN_LABEL, nearestByChain, useNearby } from '../data/nearby'
import type { Key } from '../i18n'

// A shelf of the chains' own weekly leaflets. Covers and links come from the
// chains' sites (collected daily by collector/leaflets.mjs); the leaflets
// themselves open on those sites, nothing is copied into the app.
// S Group has no nationwide leaflet (each regional cooperative makes its own,
// and Osuuskauppa KPO does not publish its weekly ads online), so S stores are
// not listed.
type Status = 'now' | 'soon'
export type Leaflet = { name: string; period?: string; url: string; image?: string; status?: Status }
type Chain = { chain: string; about: Key; aboutText?: string; leaflets: Leaflet[]; km?: number }

const LIDL_PAGE = 'https://www.lidl.fi/c/tarjouslehdet/s10019134'
const TOK_PAGE = 'https://tarjoussanomat.tokmanni.fi/Tarjoussanomat/'
const IMG_HOSTS = ['https://imgproxy.leaflets.schwarz/', 'https://cdn.ipaper.io/', 'https://tarjoussanomat.tokmanni.fi/', 'https://view.publitas.com/', 'https://view.promozilla.com/']
const safeImg = (u?: unknown) => (typeof u === 'string' && IMG_HOSTS.some((h) => u.startsWith(h)) ? u : undefined)

type Collected = LeafletFeed

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
/** "4.–8.11." from the dates read out of the leaflet. */
function periodOf(l: { from?: string; until?: string }) {
  if (!l.until) return undefined
  const [, um, ud] = l.until.split('-').map(Number)
  if (!l.from) return `–${ud}.${um}.`
  const [, fm, fd] = l.from.split('-').map(Number)
  return fm === um ? `${fd}.–${ud}.${um}.` : `${fd}.${fm}.–${ud}.${um}.`
}
/** Now / coming / past from the dates read out of the leaflet. */
function datedStatus(l: { from?: string; until?: string }): Status | 'past' | undefined {
  if (!l.until) return undefined
  const today = new Date().toISOString().slice(0, 10)
  if (l.until < today) return 'past'
  return l.from && l.from > today ? 'soon' : 'now'
}

function weekStatus(name: string): Status | 'past' | undefined {
  // Tokmanni's Tarjoussanomat link always opens the newest issue.
  if (/^tarjoussanomat$/i.test(name.trim())) return 'now'
  // A catalogue for an earlier year has ended.
  const year = name.match(/\b(20\d{2})\b/)?.[1]
  if (year && +year < new Date().getFullYear()) return 'past'
  // "vk 45", "vko45", or Rusta's "DM 2645" (year 26, week 45)
  const m = name.match(/\b(?:vko?|week)\.?\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\b/i) ?? name.match(/\bDM\s*\d{2}(\d{2})\b/i)
  if (!m) return undefined
  const w = +m[1]
  const cur = isoWeek()
  // A leaflet for several weeks ("Week 45-46") is current through its last week.
  if (m[2] && cur >= w && cur <= +m[2]) return 'now'
  if (w === cur) return 'now'
  // Week numbers wrap at new year.
  const ahead = (w - cur + 53) % 53
  return ahead > 0 && ahead < 4 ? 'soon' : 'past'
}
const order = (l: Leaflet) => (l.status === 'now' ? 0 : l.status === 'soon' ? 2 : 1)

export function useShelf(): { shelf: Chain[]; updated?: string } {
  const { t } = useStore()
  const { stores } = useNearby()
  const near = stores ? nearestByChain(stores) : null
  const [data, setData] = useState<Collected | null>(null)
  useEffect(() => {
    loadLeaflets().then(setData)
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
  // Shops publishing on Publitas: titles tidied, old issues hidden.
  const tidy = (n: string) => n.replace(/^Halpa ?Halli\s+/i, '').replace(/\bweek\s*(\d+)\s*[-–]\s*(\d+)/i, 'Vko $1–$2').replace(/\bvko\s*(\d+)\s*(20\d{2})?/i, 'Vko $1').replace(/\bDM\s*\d{2}(\d{2})\s*FI\b/i, 'Kuvasto vko $1').replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase())
  const pub = (list?: { name: string; url: string; image?: string; from?: string; until?: string }[]) => (list ?? [])
    .filter((l) => typeof l.url === 'string' && /^https:\/\/view\.(publitas|promozilla)\.com\//.test(l.url))
    .map((l) => ({ name: tidy(l.name), url: l.url, image: safeImg(l.image), period: periodOf(l), status: datedStatus(l) ?? weekStatus(l.name) }))
    .filter((l) => l.status !== 'past')
    .map((l) => ({ ...l, status: l.status as Status | undefined }))
    .sort((a, b) => order(a) - order(b))
  const more: Chain[] = ([
    ['Halpa-Halli', 'offers.hh', pub(data?.halpahalli), 'halpahalli'],
    ['Minimani', 'offers.mini', pub(data?.minimani), null],
    ['Rusta', 'offers.rusta', pub(data?.rusta), null],
  ] as const).filter(([, , l]) => l.length).map(([chain, about, leaflets]) => ({ chain, about, leaflets }))
  const shelf: Chain[] = [
    {
      chain: 'Lidl', about: 'offers.lidl', km: near?.get('lidl')?.km,
      leaflets: lidl.length ? lidl : [{ name: t('offers.all'), url: LIDL_PAGE }],
    },
    {
      chain: 'Tokmanni', about: 'offers.tok', km: near?.get('tokmanni')?.km,
      leaflets: tok.length ? tok : [{ name: 'Tarjoussanomat', period: week, url: TOK_PAGE }],
    },
    {
      chain: 'K-Ruoka', about: near && [...near.values()].some((x) => x.kSlug) ? 'offers.kNear' : 'offers.kAbout',
      // With the user's position, each K chain opens the leaflet of the nearest
      // store of that chain (stores have their own leaflets); otherwise the
      // chain's general digital leaflet.
      leaflets: (['k-citymarket', 'k-supermarket', 'k-market'] as const)
        .map((c) => {
          const st = near?.get(c)
          return st?.kSlug
            ? { name: st.name, period: week, url: `https://www.k-ruoka.fi/tarjouslehdet/kauppa/${st.kSlug}`, km: st.km }
            : { name: CHAIN_LABEL[c], period: week, url: `https://www.k-ruoka.fi/${c}/tarjouslehti`, km: st?.km ?? Infinity }
        })
        .sort((x, y) => x.km - y.km)
        .map(({ km: _km, ...l }) => l),
      km: Math.min(...(['k-citymarket', 'k-supermarket', 'k-market'] as const).map((c) => near?.get(c)?.km ?? Infinity)),
    },
  ]
  shelf.push(...more)
  // Closest chains first once the position is known.
  if (near) shelf.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
  return { shelf, updated: typeof data?.updated === 'string' ? data.updated : undefined }
}

const CHAIN_ID: Record<string, string> = { Lidl: 'lidl', Tokmanni: 'tokmanni', Minimani: 'minimani', Rusta: 'rusta', 'Halpa-Halli': 'halpahalli', 'K-Ruoka': 'k' }

/** showStore: the store's name under the cover; compact: store + one line of title; logo: the store's logo in the corner instead of its name underneath (home page). */
export function Cover({ chain, l, showStore = true, compact, logo }: { chain: string; l: Leaflet; showStore?: boolean; compact?: boolean; logo?: boolean }) {
  if (logo) showStore = false
  const { t } = useStore()
  const [broken, setBroken] = useState(false)
  const [wide, setWide] = useState(false)
  return (
    <a className={'cover' + (logo ? ' has-logo' : '')} href={l.url} target="_blank" rel="noreferrer" onClick={inAppLink(l.url)}>
      <div className="cover-img">
        {l.status && <span className={'cover-badge ' + l.status}>{t(l.status === 'now' ? 'offers.now' : 'offers.soon')}</span>}
        {logo && <ChainMark chain={CHAIN_ID[chain] ?? chain.toLowerCase()} label={l.name.startsWith('K-') ? l.name.split(' ')[0] : chain} />}
        {l.image && !broken ? (
          <img
            src={l.image} alt="" loading="lazy" referrerPolicy="no-referrer" className={wide ? 'wide' : undefined}
            onLoad={(e) => setWide(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight)}
            onError={() => setBroken(true)}
          />
        ) : (
          <span className={'cover-blank c-' + chain.toLowerCase().replace(/[^a-z]/g, '')} aria-hidden>
            <b>{(l.name.startsWith('K-') ? l.name.split(' ')[0] : chain).replace('-', '\u2011')}</b>
            <small>{t('offers.leaflet')}</small>
          </span>
        )}
      </div>
      {showStore && (
        <div className={'cover-store c-' + chain.toLowerCase().replace(/[^a-z]/g, '')}>
          {l.name.startsWith('K-') ? l.name.split(' ')[0] : chain}
        </div>
      )}
      {!(showStore && l.name.trim() === (l.name.startsWith('K-') ? l.name.split(' ')[0] : chain)) && (
        <div className={'cover-name' + (compact ? ' one' : '')}>{l.name}</div>
      )}
      {!compact && l.period && <div className="cover-period">{l.period}</div>}
    </a>
  )
}

export function Leaflets() {
  const { t, lang } = useStore()
  const { shelf, updated } = useShelf()
  const [only, setOnly] = useState<string>('all')
  useEffect(() => { markLeafletsSeen() }, [])
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
            {c !== 'all' && <ChainMark chain={CHAIN_ID[c] ?? c.toLowerCase()} inline />}
            {c === 'all' ? t('offers.allChains') : c}
          </button>
        ))}
      </div>
      {shown.map((c) => (
        <div key={c.chain} className="section">
          <div className="section-head">
            <h2 className="chain-head"><ChainMark chain={CHAIN_ID[c.chain] ?? c.chain.toLowerCase()} inline /><span className="chain-name">{c.chain}</span></h2>
            <span className="muted tiny" style={{ textAlign: 'right' }}>{c.aboutText ?? t(c.about)}</span>
          </div>
          <div className="shelf">
            {c.leaflets.map((l) => <Cover key={l.url} chain={c.chain} l={l} showStore={c.chain === 'K-Ruoka'} />)}
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
