// Opens an outside page (a store's leaflet page, a source link).
// In the Android/iPhone app it opens in the in-app browser, so the user stays
// in the app and closes it with one tap. On the web, the link opens normally.

import { Capacitor } from '@capacitor/core'

export const isNativeApp = Capacitor.isNativePlatform()

export async function openInApp(url: string) {
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url, presentationStyle: 'popover', toolbarColor: '#ffffff' })
}

/** onClick handler for an <a href>: in the native app, open in the in-app browser instead. */
export function inAppLink(url: string) {
  return (e: { preventDefault: () => void }) => {
    if (!isNativeApp) return
    e.preventDefault()
    openInApp(url).catch(() => window.open(url, '_blank'))
  }
}
