const CACHE_NAME = 'barakah-pwa-cache-v3';
const STATIC_CACHE = [
  '/manifest.json'
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

  // Never intercept Firebase, API, Firestore, or non-GET traffic.
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase')
  ) {
    return;
  }

  // HTML/navigation must always prefer the network. This prevents an old
  // index.html/app bundle from trapping Safari/iOS in a stale loading state.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => response)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache only immutable/static assets. Vite's hashed JS/CSS files are safe
  // to cache, while the HTML shell is intentionally not cached.
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
