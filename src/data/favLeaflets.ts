import { useEffect, useState } from 'react'

// Favourite leaflet shops (by chain name, e.g. "Lidl"): their leaflets come
// first. Kept on the phone and synced to the account (data/account.ts).
const KEY = 'hintaopas:favLeaflets'
const EVENT = 'hintaopas:favLeaflets'

function read(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}

export function toggleFavLeaflet(chain: string) {
  const now = read()
  const next = now.includes(chain) ? now.filter((c) => c !== chain) : [...now, chain]
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVENT))
  window.dispatchEvent(new Event('hintaopas:changed'))
}

export function useFavLeaflets(): string[] {
  const [fav, setFav] = useState(read)
  useEffect(() => {
    const on = () => setFav(read())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return fav
}

/** Favourites first, otherwise in the given order. */
export function favFirst<T>(items: T[], chainOf: (x: T) => string, fav: string[]): T[] {
  if (!fav.length) return items
  return [...items.filter((x) => fav.includes(chainOf(x))), ...items.filter((x) => !fav.includes(chainOf(x)))]
}
