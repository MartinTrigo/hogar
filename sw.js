/* Service worker: guarda la app para que abra sin señal.
   Solo intercepta GET del mismo origen: la sincronización con
   script.google.com pasa directo a la red.
   El sitio (martintrigo.github.io) es compartido con AMA y BioSalud:
   este service worker borra SOLO sus propios cachés (prefijo "hogar-").
   Al cambiar cualquier archivo, subir CACHE. */
const CACHE = 'hogar-v2';
const ARCHIVOS = [
  './', './index.html', './styles.css', './logo.svg', './manifest.json', './fuentes/figtree.woff2',
  './js/util.js', './js/datos.js', './js/graficos.js', './js/cargar.js', './js/mes.js',
  './js/movimientos.js', './js/informes.js', './js/papeles.js', './js/sincro.js',
  './js/ajustes.js', './js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('hogar-') && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

/* Primero la red (preguntando si cambió: 'no-cache' usa el ETag y cuesta
   casi nada); si no llega en 3 s o no hay señal, la copia guardada. */
const ESPERA_RED_MS = 3000;

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(redOCopia(e.request));
});

function redOCopia(pedido) {
  const red = fetch(pedido, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(pedido, copia)); }
    return res;
  });
  const plazo = new Promise(ok => setTimeout(ok, ESPERA_RED_MS));
  return Promise.race([red.catch(() => null), plazo]).then(res =>
    res || caches.match(pedido, { ignoreSearch: true }).then(c => c || red));
}
