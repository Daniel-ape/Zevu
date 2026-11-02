import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { isNativeApp } from './data/openLink'

// Offline support for the web app (the phone apps already have their files).
if ('serviceWorker' in navigator && !isNativeApp && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* not allowed here (e.g. inside a preview frame): the app still works online */
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
