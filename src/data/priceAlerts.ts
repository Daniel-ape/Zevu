import { useEffect } from 'react'
import { BackgroundRunner } from '@capacitor/background-runner'
import { isNativeApp } from './openLink'
import { useStore } from './store'

// Installed app only: hands the watch list to the background runner
// (public/runners/background.js), which checks the collected store prices every
// few hours and sends a notification when a watched product gets cheaper,
// reaches the price the user waits for, or turns up in a leaflet offer.
// The web app has no background work; it shows price changes on the home page.
const LABEL = 'fi.hintaopas.app.pricecheck'

export function usePriceAlerts() {
  const { watched, products, lang } = useStore()
  const key = watched.map((w) => `${w.productId}:${w.baselineCents}:${w.targetCents ?? ''}`).join(',')
  useEffect(() => {
    if (!isNativeApp) return
    const items = watched
      .filter((w) => w.productId.startsWith('off:'))
      .map((w) => {
        const p = products.find((x) => x.id === w.productId)
        return {
          ean: w.productId.slice(4),
          name: p?.name ?? w.productId.slice(4),
          brand: p?.brand ?? '',
          baselineCents: w.baselineCents,
          targetCents: w.targetCents ?? null,
        }
      })
    ;(async () => {
      try {
        await BackgroundRunner.dispatchEvent({ label: LABEL, event: 'syncWatch', details: { items, lang } })
        if (items.length) {
          const p = await BackgroundRunner.checkPermissions()
          if (p.notifications !== 'granted') await BackgroundRunner.requestPermissions({ apis: ['notifications'] })
        }
      } catch {
        /* runner unavailable: notifications just don't happen */
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lang, products.length > 0])
}
