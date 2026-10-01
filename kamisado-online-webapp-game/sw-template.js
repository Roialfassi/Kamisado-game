/* Kamisado service worker. The build (vite.config.ts) replaces the two placeholders below with a
 * per-build version and the list of every emitted file, so a new deploy installs a fresh cache and
 * the whole app - including the AI worker script - works offline after the first visit. */
const VERSION = '__VERSION__';
const CACHE = `kamisado-${VERSION}`;
const FILES = __FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        // Keep the newest previous generation: a tab still running the old build lazily loads files (the AI
        // worker, code-split chunks) that only exist in its cache. Versions are fixed-width base-36 timestamps,
        // so a plain sort orders them by age.
        const old = keys.filter((k) => k.startsWith('kamisado-') && k !== CACHE).sort();
        return Promise.all(old.slice(0, -1).map((k) => caches.delete(k)));
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fonts etc.: let the browser deal with them

  // Page loads: network first (so a new deploy shows up), the cached app shell when offline. Only a good,
  // same-origin page may replace the cached shell - an error page or a captive-portal response must not.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put('/index.html', copy)));
          }
          return res;
        })
        .catch(() => caches.open(CACHE).then((cache) => cache.match('/index.html').then((hit) => hit || cache.match('/')))),
    );
    return;
  }

  // Everything else: cache first (this build's cache, then any older generation), fill from the network on a miss.
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(req))
      .then((hit) => hit || caches.match(req))
      .then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              event.waitUntil(caches.open(CACHE).then((cache) => cache.put(req, copy)));
            }
            return res;
          }),
      ),
  );
});
