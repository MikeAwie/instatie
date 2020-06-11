self.staticCacheName = 'instatie-static';
self.staticCacheVersion = 'v1';
self.staticCacheId = `${self.staticCacheName}-${self.staticCacheVersion}`;
self.runtimeCacheName = 'instatie-runtime';
self.importScripts('./cache-manifest.js', './db-helpers.js');

self.openOrFocus = (url) =>
  clients
    .matchAll({
      type: 'window',
    })
    .then((clientsList) => {
      for (const client of clientsList) {
        if ((url === '*' && client.url.startsWith('/')) || url === client.url) {
          return client.focus();
        }
      }
      return clients.openWindow(url === '*' ? '/' : url);
    });

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(self.staticCacheId).then((cache) => cache.addAll(self.precacheManifest)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((cacheName) => cacheName.startsWith(self.staticCacheName) && cacheName !== self.staticCacheId)
              .map((cacheName) => caches.delete(cacheName)),
          ),
        ),
      self.openDB(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
    return Promise.resolve();
  }

  if (event.request.method !== 'GET') {
    return event.respondWith(fetch(event.request));
  }

  const idbCacheRegex = self.runtimeIDBCacheManifest.find((regex) => regex.test(event.request.url));
  if (idbCacheRegex) {
    const [, store] = idbCacheRegex.exec(event.request.url);
    return event.respondWith(
      self.getAllFromDB(store).then((data) => {
        const reqPromise = fetch(event.request)
          .then((res) => {
            const clonedRes = res.clone();
            return res
              .json()
              .then((data) => self.putIntoDB(store, data))
              .then(() => clonedRes);
          })
          .then((res) => res.json())
          .then((res) => {
            self.putIntoDB(store, res);
            return new Response(JSON.stringify(res));
          });
        if (data && Object.keys(Array.isArray(data) ? data : [data]).length > 0) {
          return new Response(
            JSON.stringify({
              success: true,
              data,
            }),
          );
        }
        return reqPromise;
      }),
    );
  }

  const promise = caches.match(event.request).then((response) => response || fetch(event.request));
  if (self.runtimeCacheManifest.some((regex) => regex.test(event.request.url))) {
    promise.then((fetchRes) => {
      const clone = fetchRes.clone();
      if (!clone) {
        return;
      }
      caches.open(self.runtimeCacheName).then((cache) => cache.put(event.request.url, clone));
    });
  }
  event.respondWith(promise);
});

self.addEventListener('message', (event) => {
  switch (event.data.action) {
    case 'update':
      self.skipWaiting();
      break;
  }
});

self.addEventListener('sync', (event) => {
  switch (event.tag) {
    case 'fetch':
      event.waitUntil(
        self.getAllFromDB('fetch-queue').then((queue) =>
          Promise.all(
            queue.map((reqParams) =>
              fetch(reqParams.url, reqParams)
                .then((res) => res.json())
                .then((res) => res.success || Promise.reject(res))
                .then(() => self.removeFromDB('fetch-queue', reqParams.id)),
            ),
          ),
        ),
      );
      break;
  }
});

self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      icon: '/images/icons/icon-512x512.png',
      badge: '/images/icons/mstile-70x70.png',
      ...data,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  switch (event.action) {
    case 'dismiss':
      break;
    case 'open-background-sync-page':
      event.waitUntil(self.openOrFocus('/background-sync'));
      break;
    default:
      event.waitUntil(self.openOrFocus('*'));
      break;
  }
});
