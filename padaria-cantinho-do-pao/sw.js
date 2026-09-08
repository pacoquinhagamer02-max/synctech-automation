const CACHE = 'cantinho-app-v3';
const SHELL = [
  './manifest.json',
  './assets/logo.jpg',
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// Network-first para navegação (HTML) — nunca prende o usuário numa versão
// antiga do app. Cache-first (com atualização em segundo plano) só pros
// arquivos estáticos (ícone, manifest), que mudam raramente.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  var isNavigation = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    e.respondWith(
      fetch(e.request)
        .then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          }
          return res;
        })
        .catch(function () { return caches.match(e.request); })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetchPromise = fetch(e.request)
        .then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          }
          return res;
        })
        .catch(function () { return cached; });
      return cached || fetchPromise;
    })
  );
});
