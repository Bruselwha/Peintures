/* Arij Color · Service Worker
   Versión de caché única; solo se consulta la caché actual para no servir
   archivos antiguos. HTML network-first, estáticos cache-first. */
const CACHE_VERSION = 'arij-v7';
const CACHE_NAME = 'arijcolor-' + CACHE_VERSION;

const PRECACHE = [
  './index.html',
  './login.html',
  './dashboard.html',
  './catalogo.html',
  './catalogo?b=peintures',
  './porfolio.html',
  './assets/css/portfolio.css?v=5',
  './assets/js/portfolio.js?v=6',
  './manifest.webmanifest',
  './assets/css/styles.css?v=23',
  './assets/css/home.css?v=11',
  './assets/css/landing.css?v=9',
  './assets/css/catalog.css?v=16',
  './assets/css/assistant.css?v=7',
  './assets/js/config.js?v=11',
  './assets/js/i18n.js?v=26',
  './assets/js/store.js?v=13',
  './assets/js/panel-i18n.js?v=4',
  './assets/js/common.js?v=17',
  './assets/js/policies.js?v=7',
  './assets/js/landing.js?v=2',
  './assets/js/auth.js?v=10',
  './assets/js/translate.js?v=2',
  './assets/js/dashboard.js?v=23',
  './assets/js/catalog.js?v=22',
  './assets/js/assistant.js?v=9'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => (k.startsWith('arijcolor-') || k.startsWith('arijcolor-')) && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const isHTML = req.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    // network-first. Si no hay red, se sirve lo cacheado y, como último
    // recurso, el catálogo (nunca index.html: es una página que redirige y
    // podría provocar un bucle en la app instalada).
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.open(CACHE_NAME).then((c) =>
        c.match(req)
          .then((r) => r || c.match('./catalogo?b=peintures') || c.match('./catalogo.html'))
      ))
    );
    return;
  }
  // cache-first con actualización en segundo plano
  e.respondWith(
    caches.open(CACHE_NAME).then((c) =>
      c.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res && res.status === 200) c.put(req, res.clone()).catch(() => {});
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
