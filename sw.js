/* KaizzShop service worker — app shell cache */
const CACHE = 'kaizz-v6';
const SHELL = [
  './',
  './index.html',
  './assets/css/styles.css',
  './assets/js/config.js',
  './assets/js/khqr.js',
  './assets/js/app.js',
  './assets/vendor/qrcode.min.js',
  './assets/img/kaizz-brand.jpg',
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

function removePosterFeatures(response) {
  if (!response || !response.headers.get('content-type')?.includes('text/html')) return response;

  return response.text().then((html) => {
    html = html.replace(/\s*<a class="btn btn-ghost btn-sm" href="assets\/img\/kaizz-poster\.jpg" download="KaizzShop-Price-List\.jpg">[\s\S]*?<\/a>/, '');
    html = html.replace(/\s*<section class="section poster-section">[\s\S]*?<\/section>/, '');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('./index.html'))
        .then(removePosterFeatures)
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
