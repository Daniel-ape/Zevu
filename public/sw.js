// Keeps Hintaopas working without a connection (e.g. inside a store).
// App files, product data and the text-recognition engine are cached after
// first use; pages and prices are fetched fresh when online.
const CACHE = 'hintaopas-v1'
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './products/fi.json']

// On install, save the app shell and the files index.html loads, so the app
// opens offline even if the first visit happened before this worker took over.
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE)
      await Promise.allSettled(CORE.map((u) => c.add(u)))
      try {
        const html = await (await fetch('./index.html', { cache: 'no-store' })).text()
        const files = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1])
        await Promise.allSettled(files.map((u) => c.add(u)))
      } catch {
        /* offline during install: files are cached as they are used */
      }
    })(),
  )
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return // Open Food Facts, fonts: straight to the network

  const fresh = req.mode === 'navigate' || url.pathname.includes('/prices/')
  if (fresh) {
    // Network first, so updates and new prices arrive; cached copy when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()))
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
    )
    return
  }
  // App files (hashed), product data, pictures, OCR engine: cache first.
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()))
          return res
        }),
    ),
  )
})
