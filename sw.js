/* KaizzShop service worker — app shell cache */
const CACHE = 'kaizz-v4';
const SHELL = [
  './',
  './index.html',
  './assets/css/styles.css',
  './assets/js/config.js',
  './assets/js/khqr.js',
  './assets/js/app.js',
  './assets/vendor/qrcode.min.js',
  './assets/img/kaizz-brand.jpg',
  './assets/img/kaizz-poster.jpg',
  './assets/img/aba-qr.jpg',
  './assets/img/favicon.svg',
  './assets/img/icon-192.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
