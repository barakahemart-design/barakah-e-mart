const CACHE_NAME = 'barakah-pwa-cache-v17';
const STATIC_CACHE = [
  '/manifest.json',
  '/barakah-icon.svg?v=icon-17',
  '/barakah-icon-192.png?v=icon-17',
  '/barakah-icon-512.png?v=icon-17'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cache) => cache !== CACHE_NAME)
          .map((cache) => caches.delete(cache))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.startsWith('/api') || url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('firebase')) return;
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(fetch(request, { cache: 'no-store' }).then((response) => response).catch(() => caches.match('/index.html')));
    return;
  }
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'image') {
    event.respondWith(caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    }));
  }
});
self.addEventListener('message', (event) => { if (event.data === 'skipWaiting') self.skipWaiting(); });
