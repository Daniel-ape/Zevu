// The web app used to live here and installed an offline helper for this whole
// folder. It now lives in /app/ with its own helper, so this one removes itself
// and its saved files, and the homepage and the app load normally.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (/^hintaopas-v[12]$/.test(k)) await caches.delete(k)
    await self.registration.unregister()
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url)
  })())
})
