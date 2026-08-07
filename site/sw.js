const CACHE_NAME = 'catalogo-qr-antigravity-v6';



const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/app.css',
  './assets/vendor/qrcode.js',
  './assets/js/app.js',
  './assets/js/crypto.js',
  './assets/js/catalog.js',
  './assets/js/search.js',
  './assets/js/qr-view.js',
  './assets/js/camera-scanner.js',
  './assets/js/print-batch.js',
  './assets/js/shortcuts.js',
  './assets/js/storage.js',
  './assets/js/audio-feedback.js',
  './assets/js/clipboard.js',
  './assets/js/dashboard.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // O arquivo de dados cifrados catalogo.enc.json NUNCA deve ser servido de cache antigo no celular
  if (url.includes('catalogo.enc.json')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
