const CACHE_NAME = 'la-gastoteca-shell-v2'
const APP_SCOPE = self.registration.scope
const INDEX_URL = new URL('./index.html', APP_SCOPE).toString()
const APP_SHELL = [
  new URL('./', APP_SCOPE).toString(),
  INDEX_URL,
  new URL('./manifest.webmanifest', APP_SCOPE).toString(),
  new URL('./icons/gastoteca.svg', APP_SCOPE).toString(),
  new URL('./icons/favicon-32.png', APP_SCOPE).toString(),
  new URL('./icons/apple-touch-icon.png', APP_SCOPE).toString(),
  new URL('./icons/icon-192.png', APP_SCOPE).toString(),
  new URL('./icons/icon-512.png', APP_SCOPE).toString(),
  new URL('./icons/icon-maskable-192.png', APP_SCOPE).toString(),
  new URL('./icons/icon-maskable-512.png', APP_SCOPE).toString(),
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(INDEX_URL)))
    return
  }
  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
      return response
    })))
  }
})
