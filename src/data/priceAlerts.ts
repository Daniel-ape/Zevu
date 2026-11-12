import { productById } from '../domain/productIndex'
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
  // Also check when the app is put away, so a drop is told even if the system waits long.
  useEffect(() => {
    if (!isNativeApp) return
    let last = 0
    const vis = () => { if (document.visibilityState === 'hidden' && Date.now() - last > 30 * 60_000) { last = Date.now(); checkNow() } }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [])
  const key = watched.map((w) => `${w.productId}:${w.baselineCents}:${w.targetCents ?? ''}`).join(',')
  useEffect(() => {
    if (!isNativeApp) return
    const items = watched
      .filter((w) => w.productId.startsWith('off:'))
      .map((w) => {
        const p = productById(products, w.productId)
        return {
          ean: w.productId.slice(4),
          name: p?.name ?? w.productId.slice(4),
          brand: p?.brand ?? '',
          baselineCents: w.baselineCents,
          targetCents: w.targetCents ?? null,
        }
      })
    // On Android the price checker only runs while the app is on screen, so a
    // change made just before leaving the app is sent again when it comes back.
    const send = () => BackgroundRunner.dispatchEvent({ label: LABEL, event: 'syncWatch', details: { items, lang } })
    ;(async () => {
      try {
        await send().catch(() => new Promise<void>((resolve, reject) => {
          const again = () => { if (document.visibilityState !== 'visible') return; document.removeEventListener('visibilitychange', again); setTimeout(() => send().then(() => resolve(), reject), 800) }
          document.addEventListener('visibilitychange', again)
        }))
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

/** Whether price notifications may be shown ('na' outside the installed app). */
export async function notifyStatus(): Promise<'on' | 'off' | 'na'> {
  if (!isNativeApp) return 'na'
  try { return (await BackgroundRunner.checkPermissions()).notifications === 'granted' ? 'on' : 'off' } catch { return 'na' }
}
export async function allowNotify(): Promise<'on' | 'off' | 'na'> {
  if (!isNativeApp) return 'na'
  try { await BackgroundRunner.requestPermissions({ apis: ['notifications'] }) } catch { /* shown as off */ }
  return notifyStatus()
}
/** A notification right away, to show the user that they arrive. */
export async function testNotify(title: string, body: string): Promise<boolean> {
  try { await BackgroundRunner.dispatchEvent({ label: LABEL, event: 'testNotify', details: { title, body } }); return true } catch { return false }
}
/** Runs the price check now (when the app goes to the background), besides the system's own schedule. */
export function checkNow() {
  if (!isNativeApp) return
  BackgroundRunner.dispatchEvent({ label: LABEL, event: 'checkPrices', details: {} }).catch(() => {})
}
