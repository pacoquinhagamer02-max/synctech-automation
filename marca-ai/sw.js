// Rede primeiro: com internet, sempre a versão nova; sem internet, a última cópia boa.
// Mude VERSAO a cada publicação pra limpar o cache antigo.
const VERSAO = 'marcaai-v4';
const ARQUIVOS = [
  './', 'index.html', 'manifest.json', 'icon.svg', 'css/app.css',
  'js/app.js', 'js/regras.js', 'js/esquema.js', 'js/store.js', 'js/ui.js',
  'fonts/saira.woff2', 'fonts/sairacondensed-500.woff2', 'fonts/sairacondensed-700.woff2', 'fonts/sairacondensed-800.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Só arquivos do próprio app; nada de terceiros entra no cache.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      // Guarda só respostas boas e do mesmo site (sem erro 404/500 nem resposta opaca).
      if (r.ok && r.type === 'basic') {
        const copia = r.clone();
        caches.open(VERSAO).then(c => c.put(e.request, copia));
      }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
