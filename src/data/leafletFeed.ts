import { useEffect, useState } from 'react'
import { fetchData } from './dataFile'

// The collected leaflet list (collector/leaflets.mjs), loaded once and shared by
// the Leaflets page and the dock, which shows a dot when a leaflet has appeared
// since the page was last opened.
export type LeafletFeed = {
  updated?: string
  lidl?: { name: string; period: string; url: string; image?: string }[] | null
  tokmanni?: { name: string; url: string; image?: string }[] | { image?: string } | null
  minimani?: { name: string; url: string; image?: string }[]
  rusta?: { name: string; url: string; image?: string }[]
  halpahalli?: { name: string; url: string; image?: string }[]
}

let feed: Promise<LeafletFeed | null> | null = null
export const loadLeaflets = () => (feed ??= fetchData<LeafletFeed>('leaflets.json'))

const KEY = 'hintaopas:leafletsSeen'
const EVENT = 'hintaopas:leaflets-seen'
const urlsOf = (d: LeafletFeed | null) => [
  ...(d?.lidl ?? []).map((l) => l.url),
  ...(Array.isArray(d?.tokmanni) ? d.tokmanni.map((l) => l.url) : []),
  ...[d?.minimani, d?.rusta, d?.halpahalli].flatMap((x) => (x ?? []).map((l) => l.url)),
].filter((u): u is string => typeof u === 'string')

function readSeen(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}
function writeSeen(urls: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(urls)) } catch { /* private mode */ }
  dispatchEvent(new Event(EVENT))
}

/** Remember every current leaflet as seen (called when the page opens). */
export function markLeafletsSeen() {
  loadLeaflets().then((d) => writeSeen(urlsOf(d)))
}

/** True when a leaflet is listed that the user has not seen yet. */
export function useNewLeaflets() {
  const [hasNew, setHasNew] = useState(false)
  useEffect(() => {
    const check = () =>
      loadLeaflets().then((d) => {
        const urls = urlsOf(d)
        const seen = readSeen()
        // First run: nothing is "new" yet, just remember what exists.
        if (!seen) { if (urls.length) writeSeen(urls); setHasNew(false); return }
        setHasNew(urls.some((u) => !seen.includes(u)))
      })
    check()
    addEventListener(EVENT, check)
    return () => removeEventListener(EVENT, check)
  }, [])
  return hasNew
}
