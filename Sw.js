// ISAM Service Worker
// Strategi: cache-first (stale-while-revalidate) untuk app shell statis,
// network-only untuk request ke Apps Script (data harus selalu fresh)

const CACHE_NAME = 'isam-cache-v3';

const APP_SHELL = [
  'index.html',
  'dashboard.html',
  'form-inspeksi.html',
  'monitoring.html',
  'qr-generator.html',
  'scan.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
];

// Domain backend Apps Script — request ke sini TIDAK boleh di-cache
const NO_CACHE_HOST = 'script.google.com';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Method selain GET (POST submit ke Apps Script) -> selalu lewat network
  if (event.request.method !== 'GET') return;

  // Request ke Apps Script (data dinamis) -> network-only, jangan cache
  if (url.hostname.includes(NO_CACHE_HOST)) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ status: 'error', message: 'Offline - tidak bisa ambil data terbaru' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // File statis (app shell) -> cache-first, lalu refresh di background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        fetch(event.request)
          .then((fresh) => caches.open(CACHE_NAME).then((cache) => cache.put(event.request, fresh)))
          .catch(() => {});
        return cached;
      }
      return fetch(event.request).then((fresh) => {
        const copy = fresh.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return fresh;
      }).catch(() => caches.match('index.html'));
    })
  );
});