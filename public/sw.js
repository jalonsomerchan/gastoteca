const CACHE_PREFIX = 'la-gastoteca-shell-'
const CACHE_NAME = `${CACHE_PREFIX}__BUILD_VERSION__`
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
const BUILD_ASSETS = '__PRECACHE_ASSETS__'

async function fetchWithTimeout(request) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try { return await fetch(request, { signal: controller.signal }) }
  finally { clearTimeout(timer) }
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([
    ...APP_SHELL,
    ...BUILD_ASSETS.map(path => new URL(path, APP_SCOPE).toString()),
  ])))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX))
    // Keep the preceding build for lazy imports in tabs that are still open.
    const previous = keys.filter(key => key !== CACHE_NAME).slice(-1)
    await Promise.all(keys.filter(key => key !== CACHE_NAME && !previous.includes(key)).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const iconResource = url.hostname === 'api.iconify.design'
  const fontResource = ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)
  const builtAsset = url.origin === self.location.origin && url.pathname.startsWith(new URL('./assets/', APP_SCOPE).pathname)
  if (url.origin !== self.location.origin && !iconResource && !fontResource) return

  if (request.mode === 'navigate') {
    event.respondWith(fetchWithTimeout(request).then(response => {
      if (!response.ok) throw new Error('Navigation unavailable')
      return response
    }).catch(async () => (await caches.open(CACHE_NAME)).match(INDEX_URL)))
    return
  }
  if (builtAsset || iconResource || fontResource || ['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await caches.match(request, { ignoreVary: builtAsset })
      if (cached) return cached
      const response = await fetchWithTimeout(request)
      if (response.ok || (fontResource && response.type === 'opaque')) {
        try { await cache.put(request, response.clone()) } catch { /* A full cache must not block online resources. */ }
      }
      return response
    })())
  }
})
