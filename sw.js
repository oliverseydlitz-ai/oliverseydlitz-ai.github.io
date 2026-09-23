const CACHE = 'shotlab-v197';
// Precached so a first visit that goes offline before any icon has been
// fetched still paints the installed-app icon and the favicon rather than a
// broken image. og-image.png is deliberately absent — it is only ever read by
// a crawler or a share sheet, never by the app itself.
// The two font files are precached because they are now self-hosted and
// render-blocking: without them an offline first paint falls back to
// system-ui, which is the one thing self-hosting was meant to stop. The
// legal documents are precached because they are fetched at runtime and an
// offline user is still entitled to read the terms they agreed to.
const ASSETS = ['/', '/index.html', '/style.css', '/app.js', '/favicon.svg',
                '/404.html', '/manifest.json',
                '/fonts/archivo-latin.woff2', '/fonts/archivo-latin-ext.woff2',
                '/vendor/papaparse.min.js', '/vendor/chart.umd.js',
                '/vendor/idb-keyval.js', '/vendor/supabase.js',
                '/PRIVACY.md', '/TERMS.md',
                '/terms/', '/privacy/', '/contact/', '/legal.js',
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

// How long a hanging network gets before the cache answers. A range bay on
// one bar of signal ("lie-fi") does not fail, it hangs, and network-first with
// no timeout meant the page never loaded at all (R7). The network request is
// NOT abandoned: if nothing is cached it is still awaited.
const NETWORK_TIMEOUT_MS = 3000;

// Navigations that ARE the app. Any other uncached navigation offline gets
// 404.html rather than an app shell at the wrong path (R26).
const APP_PATHS = ['/', '/index.html'];

// Cross-origin requests are not intercepted at all (R1). Everything the app
// loads is self-hosted, so the only cross-origin GETs left are Supabase's —
// `/auth/v1/user` and `/rest/v1/sessions` — and this used to serve them
// CACHE-FIRST, keyed without the Authorization header, until the next version
// bump: a stale identity after switching accounts, other devices' sessions
// never appearing, and a paused project "succeeding" from cache so the
// cloud-status banner could never fire. A worker that does not touch them
// cannot do any of that.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(handle(req));
});

async function handle(req) {
  const url = new URL(req.url);
  // One entry per path (R6). Every `?query` variant used to get its own copy,
  // so the cache grew without bound; nothing this app serves varies by query.
  const key = url.origin + url.pathname;
  const net = fetch(req).then(res => {
    // Only a real success is kept (R6). A 404 or a 500 cached here would be
    // served back offline as if it were the file.
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  });
  net.catch(() => {});   // settled below; this only stops an unhandled rejection
  const timer = new Promise(r => setTimeout(r, NETWORK_TIMEOUT_MS, 'timeout'));
  try {
    const first = await Promise.race([net, timer]);
    if (first !== 'timeout') return first;
    return (await caches.match(key)) || await net;
  } catch (_) {
    const cached = await caches.match(key);
    if (cached) return cached;
    // Only a NAVIGATION falls back to a page. This used to hand index.html to
    // every failed same-origin GET, so an image, a JSON file or a CSV that was
    // merely offline came back as a page of HTML — which does not fail loudly,
    // it fails as a parse error somewhere unrelated.
    if (req.mode !== 'navigate') return Response.error();
    if (APP_PATHS.includes(url.pathname)) return caches.match('/index.html');
    const nf = await caches.match('/404.html');
    return nf ? new Response(await nf.text(), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
              : Response.error();
  }
}
