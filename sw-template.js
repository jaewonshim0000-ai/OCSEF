/*
 * Familiar Place service worker.
 * Network first for same-origin GET requests, falling back to the cache, so the
 * basics keep working offline once the app has loaded. Nothing is ever sent
 * anywhere: this only stores the app's own files on this device.
 */
// Replaced at build time with the list of built files and a version.
const CACHE = 'familiar-place-__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        // ignoreVary: module scripts send an Origin header that the cached
        // request did not have, and servers often reply with "Vary: Origin".
        const cached = await caches.match(request, { ignoreVary: true, ignoreSearch: request.mode === 'navigate' });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('./index.html', { ignoreVary: true });
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
