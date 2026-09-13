const CACHE_NAME = 'vseh-pro-cache-v10';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.jpeg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Update cache with the new version
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        // If network fails, fall back to cache
        return caches.match(event.request);
      })
  );
});
