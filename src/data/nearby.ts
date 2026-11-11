import { useEffect, useState } from 'react'

// "Stores near me": the user's position (asked for only when they tap the
// button, kept on the device) and the grocery stores around it from
// OpenStreetMap (Overpass API). Only the coordinates are sent to OpenStreetMap.
export type Chain = 'lidl' | 'tokmanni' | 'prisma' | 's-market' | 'sale' | 'k-citymarket' | 'k-supermarket' | 'k-market'
export type NearStore = { chain: Chain; name: string; lat: number; lon: number; km: number; url?: string; kSlug?: string; osm?: { type: 'NODE' | 'WAY' | 'RELATION'; id: number } }
type Pos = { lat: number; lon: number; at: string }

const POS = 'hintaopas:pos'
const STORES = 'hintaopas:stores'
const EVENT = 'hintaopas:nearby'
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
export const CHAIN_LABEL: Record<Chain, string> = {
  lidl: 'Lidl', tokmanni: 'Tokmanni', prisma: 'Prisma', 's-market': 'S-market', sale: 'Sale',
  'k-citymarket': 'K-Citymarket', 'k-supermarket': 'K-Supermarket', 'k-market': 'K-Market',
}

const read = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null } catch { return null } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(x))
}

function chainOf(tags: Record<string, string>): Chain | null {
  const b = `${tags.brand ?? ''} ${tags.name ?? ''}`.toLowerCase()
  if (/\blidl\b/.test(b)) return 'lidl'
  if (/tokmanni/.test(b)) return 'tokmanni'
  if (/prisma/.test(b)) return 'prisma'
  if (/s-market/.test(b)) return 's-market'
  if (/\bsale\b/.test(b)) return 'sale'
  if (/k-citymarket/.test(b)) return 'k-citymarket'
  if (/k-supermarket/.test(b)) return 'k-supermarket'
  if (/k-market/.test(b)) return 'k-market'
  return null
}

const title = (slug: string) => slug.split('-').filter(Boolean).map((w) => (w.length <= 2 && w !== 'k' ? w : w[0].toUpperCase() + w.slice(1))).join(' ').replace(/^K /, 'K-').replace(/^S Market/, 'S-market')

type OsmEl = { type?: 'node' | 'way' | 'relation'; id?: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }
async function fetchStores(p: { lat: number; lon: number }): Promise<Omit<NearStore, 'km'>[]> {
  const q = `[out:json][timeout:25];nwr["shop"]["brand"~"Lidl|Tokmanni|Prisma|S-market|Sale|K-Citymarket|K-Supermarket|K-Market",i](around:40000,${p.lat.toFixed(4)},${p.lon.toFixed(4)});out center tags;`
  for (const ep of ENDPOINTS) {
    try {
      const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      if (!r.ok) continue
      const d = (await r.json()) as { elements: OsmEl[] }
      return d.elements.flatMap((e) => {
        const tags = e.tags ?? {}
        const chain = chainOf(tags)
        const lat = e.lat ?? e.center?.lat
        const lon = e.lon ?? e.center?.lon
        if (!chain || lat === undefined || lon === undefined) return []
        const site = tags.website ?? tags['contact:website'] ?? ''
        const kSlug = site.match(/k-ruoka\.fi\/kauppa\/([a-z0-9-]+)/)?.[1]
        const sSlug = site.match(/s-kaupat\.fi\/myymala\/([a-z0-9-]+)\/\d+/)?.[1]
        const tSlug = site.match(/tokmanni\.fi\/store\/([a-z0-9-]+)/)?.[1]
        const city = tags['addr:city'] ?? ''
        const name = kSlug ? title(kSlug) : sSlug ? title(sSlug) : tSlug ? title(tSlug.startsWith('tokmanni') ? tSlug : `tokmanni-${tSlug}`)
          : [CHAIN_LABEL[chain], tags.name && tags.name !== tags.brand ? tags.name.replace(new RegExp(`^${CHAIN_LABEL[chain]}\\s*`, 'i'), '') : city].filter(Boolean).join(' ')
        const url = /^https:\/\/(www\.)?(k-ruoka|s-kaupat|tokmanni|lidl)\.fi\//.test(site) && !/lidl\.fi\/?$/.test(site) ? site : undefined
        // the OpenStreetMap place, which is how Open Prices names a shop
        const osm = e.type && e.id ? { type: e.type.toUpperCase() as 'NODE' | 'WAY' | 'RELATION', id: e.id } : undefined
        return [{ chain, name, lat, lon, url, kSlug, osm }]
      })
    } catch {
      /* try the next server */
    }
  }
  throw new Error('unavailable')
}

/** Ask for the position (once, on the user's tap) and load the stores around it. */
export function locate(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'))
    navigator.geolocation.getCurrentPosition(
      (g) => {
        write(POS, { lat: g.coords.latitude, lon: g.coords.longitude, at: new Date().toISOString() })
        dispatchEvent(new Event(EVENT))
        resolve()
      },
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 3_600_000 },
    )
  })
}
/**
 * Called when the app opens: refreshes the position so leaflets follow the
 * user. Asks for permission once; if the user said no, it never asks again.
 */
const ASKED = 'hintaopas:posAsked'
export function autoLocate() {
  try {
    const asked = localStorage.getItem(ASKED)
    if (asked === 'denied') return
    locate().then(
      () => localStorage.setItem(ASKED, 'granted'),
      (e: GeolocationPositionError | Error) => { if ('code' in e && e.code === 1) localStorage.setItem(ASKED, 'denied') },
    )
  } catch { /* no storage: skip */ }
}

export function forgetLocation() {
  try { localStorage.removeItem(POS); localStorage.removeItem(STORES) } catch { /* ignore */ }
  dispatchEvent(new Event(EVENT))
}

let loading: Promise<void> | null = null
/** Stores sorted by distance, or null when the user hasn't shared a position. */
export function useNearby() {
  const [state, setState] = useState<{ stores: NearStore[] | null; status: 'off' | 'loading' | 'ready' | 'error' }>({ stores: null, status: 'off' })
  useEffect(() => {
    const update = () => {
      const pos = read<Pos>(POS)
      if (!pos) return setState({ stores: null, status: 'off' })
      const cache = read<{ lat: number; lon: number; at: string; stores: Omit<NearStore, 'km'>[] }>(STORES)
      // (lists saved before shops carried their OpenStreetMap place are read again)
      const fresh = cache && km(cache, pos) < 3 && Date.now() - +new Date(cache.at) < 14 * 86_400_000 && (!cache.stores.length || !!cache.stores[0].osm)
      if (fresh) {
        const stores = cache.stores.map((s) => ({ ...s, km: km(pos, s) })).sort((a, b) => a.km - b.km)
        return setState({ stores, status: 'ready' })
      }
      setState((s) => ({ ...s, status: 'loading' }))
      loading ??= fetchStores(pos)
        .then((stores) => { write(STORES, { lat: pos.lat, lon: pos.lon, at: new Date().toISOString(), stores }) })
        .finally(() => { loading = null })
      loading.then(update, () => setState({ stores: null, status: 'error' }))
    }
    update()
    addEventListener(EVENT, update)
    return () => removeEventListener(EVENT, update)
  }, [])
  return state
}

/** The nearest store of each chain. */
export const nearestByChain = (stores: NearStore[]) => {
  const out = new Map<Chain, NearStore>()
  for (const s of stores) if (!out.has(s.chain)) out.set(s.chain, s)
  return out
}
export const distance = (k: number) => (k < 0.975 ? `${Math.round(k * 1000 / 50) * 50} m` : `${k < 10 ? k.toFixed(1).replace('.', ',') : Math.round(k)} km`)
