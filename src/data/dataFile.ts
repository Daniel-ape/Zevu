import { isNativeApp } from './openLink'
import { dataUrl } from './dataUrl'

// Daily data (prices, leaflet links) lives in public/prices/. The web app reads
// it next to itself; the installed app would otherwise only see the copy built
// into it, so it reads the live copy from the website and falls back to the
// built-in one when offline.
const LIVE = 'https://daniel-ape.github.io/hintaopas/prices/'

export async function fetchData<T>(file: string): Promise<T | null> {
  const urls = isNativeApp ? [LIVE + file, dataUrl(`prices/${file}`)] : [dataUrl(`prices/${file}`)]
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: 'no-cache' })
      if (r.ok) return (await r.json()) as T
    } catch {
      /* try the next copy */
    }
  }
  return null
}
