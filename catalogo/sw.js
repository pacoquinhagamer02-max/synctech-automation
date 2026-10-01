/* Service worker do Catalogo / Aplicativo Personalizado.
 *
 * O servico e vendido como "o cliente instala pelo link e o icone fica na
 * tela dele" e "funciona com internet ruim". Sem service worker nada disso
 * acontecia: o template era so uma pagina. O cardapio da padaria tinha os
 * dois arquivos porque foi montado a mao; o template generico, que e o que
 * um cliente novo recebe, nasceu sem.
 *
 * A configuracao do cliente viaja no hash (#config=), que nao faz parte da
 * URL que o cache guarda — entao um unico shell em cache serve todos os
 * clientes, sem vazar dados de um para outro.
 */
var VERSAO = 'catalogo-v1';
var SHELL = './';

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(VERSAO).then(function (c) { return c.add(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.filter(function (n) { return n !== VERSAO; })
                              .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Rede primeiro para o documento, cache como rede de seguranca. O preco
 * muda e o cliente nao pode ficar vendo cardapio velho; mas se a internet
 * cair, melhor o cardapio de ontem do que tela de erro. */
self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* fontes e imagens de fora passam direto */

  if (req.mode === 'navigate') {
    ev.respondWith(
      fetch(req).then(function (res) {
        var copia = res.clone();
        caches.open(VERSAO).then(function (c) { c.put(SHELL, copia); });
        return res;
      }).catch(function () {
        return caches.match(SHELL).then(function (r) { return r || Response.error(); });
      })
    );
    return;
  }

  ev.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok && res.type === 'basic') {
          var copia = res.clone();
          caches.open(VERSAO).then(function (c) { c.put(req, copia); });
        }
        return res;
      });
    })
  );
});
