const CACHE = 'shotlab-v137';
// Precached so a first visit that goes offline before any icon has been
// fetched still paints the installed-app icon and the favicon rather than a
// broken image. og-image.png is deliberately absent — it is only ever read by
// a crawler or a share sheet, never by the app itself.
const ASSETS = ['/', '/index.html', '/style.css', '/app.js', '/favicon.svg',
                '/404.html', '/manifest.json',
                '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (sameOrigin) {
    // Network-first: always try the latest, fall back to cache when offline
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(c => {
        if (c) return c;
        // Only a NAVIGATION falls back to the app shell. This used to hand
        // index.html to every failed same-origin GET, so an image, a JSON file
        // or a CSV that was merely offline came back as a page of HTML — which
        // does not fail loudly, it fails as a parse error somewhere unrelated.
        if (req.mode === 'navigate') return caches.match('/index.html');
        return Response.error();
      }))
    );
  } else {
    // Cross-origin CDN libs: cache-first (they're versioned and rarely change)
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});
