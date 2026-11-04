import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { isNativeApp } from './data/openLink'

// The phone app's dock is drawn natively above the page: styles leave room for it.
if (isNativeApp) document.documentElement.classList.add('native-app')

// Offline support for the web app (the phone apps already have their files).
if ('serviceWorker' in navigator && !isNativeApp && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    // Look for a new version whenever the app comes back to the screen
    // (home-screen apps on iPhone are often resumed rather than restarted).
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
  }).catch(() => {
    /* not allowed here (e.g. inside a preview frame): the app still works online */
  })
  // When a new version has taken over, reload once so it shows straight away.
  let reloaded = false
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return
    reloaded = true
    location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
