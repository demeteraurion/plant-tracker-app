const CACHE_NAME = 'root-record-v1'
const APP_SHELL = [
  './',
  './index.html',
  './favicon.svg',
  './favicon.ico',
  './logo.png',
  './manifest.webmanifest',
  './pwa-192x192.png',
  './pwa-512x512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const requestUrl = new URL(request.url)

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cachedResponse = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cachedResponse))
          return response
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response
        }

        const cachedResponse = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cachedResponse))
        return response
      })
    }),
  )
})
