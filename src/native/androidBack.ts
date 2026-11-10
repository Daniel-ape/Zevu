// Android's back button / back gesture. Without this the app would close at
// once, even from a product page. Now it does what a back button should, in
// order: close whatever is open on top (a sheet, the camera, store mode),
// go back from a product page, go to Home from another tab, and only on Home
// leave the app.
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

export interface BackTarget {
  hasStack: () => boolean
  back: () => void
  onHome: () => boolean
  goHome: () => void
}

function closeTopOverlay(): boolean {
  // sheets close on Escape (and on a tap on their backdrop)
  const backdrops = document.querySelectorAll<HTMLElement>('.sheet-backdrop')
  const backdrop = backdrops[backdrops.length - 1]
  if (backdrop) {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    setTimeout(() => { if (backdrop.isConnected) backdrop.click() }, 60)
    return true
  }
  // full-screen views with their own close button
  for (const [view, button] of [['.camera', '.camera-back'], ['.shop', '.shop-close'], ['.cardview', '.icon-btn, button[aria-label]']] as const) {
    const el = document.querySelector<HTMLElement>(view)
    if (el) { el.querySelector<HTMLElement>(button)?.click(); return true }
  }
  return false
}

export function setupAndroidBack(target: BackTarget): () => void {
  if (Capacitor.getPlatform() !== 'android') return () => {}
  const handle = App.addListener('backButton', () => {
    if (document.querySelector('.welcome, #splash:not(.out)')) { void App.minimizeApp(); return }
    if (closeTopOverlay()) return
    if (target.hasStack()) { target.back(); return }
    if (!target.onHome()) { target.goHome(); return }
    void App.minimizeApp() // like other Android apps: Home leaves to the launcher, the app keeps its place
  })
  return () => { void handle.then((h) => h.remove()) }
}

/**
 * On Android the screen gets shorter while the keyboard is open, which would
 * lift the bottom menu onto the keyboard over the search results. While the
 * keyboard is up the menu steps aside (class kb-open on <html>).
 */
export function setupAndroidKeyboard(): () => void {
  if (!/Android/i.test(navigator.userAgent)) return () => {}
  let tallest = innerHeight
  const check = () => {
    if (innerHeight > tallest) tallest = innerHeight
    const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
    document.documentElement.classList.toggle('kb-open', typing && innerHeight < tallest - 150)
  }
  const onTurn = () => { tallest = 0; setTimeout(() => { tallest = innerHeight; check() }, 400) }
  addEventListener('resize', check)
  addEventListener('focusin', check)
  addEventListener('focusout', () => setTimeout(check, 50))
  addEventListener('orientationchange', onTurn)
  return () => { removeEventListener('resize', check); removeEventListener('focusin', check); removeEventListener('orientationchange', onTurn) }
}
