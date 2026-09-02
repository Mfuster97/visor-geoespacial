// Service Worker del Visor Geoespacial — habilita el uso offline.
//
// Estrategia: "network-first, cache como respaldo", aplicada a TODAS las
// peticiones GET (el HTML/JS/CSS del visor, las librerías del CDN —
// Leaflet/JSZip/shpjs/shp-write— y los tiles del mapa base). No se
// pre-descarga nada al instalar: cada recurso queda cacheado recién la
// primera vez que se pide con conexión. Volver a abrir el visor sin
// internet funciona completo; el mapa se ve nítido solo en las zonas/zooms
// ya visitados antes de perder la conexión — no es una descarga de área
// completa, es una caché de "lo que ya viste".
//
// Cargar una capa nueva (archivo local) no depende de la red y sigue
// funcionando igual offline u online. Agregar/actualizar una capa WMS o
// WFS remota sí necesita red sí o sí, cacheado o no: son datos que no
// existían antes en el navegador.
const CACHE_NAME = 'visor-geoespacial-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Solo GET: no interceptar POST/PUT (ninguno de por sí existe en este
  // visor, pero por si algún CDN externo llegara a usarlo) — el Cache API
  // no admite cachear otros métodos.
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Se cachea la respuesta tal cual llega, incluidas las "opacas"
        // (tiles/CDN cross-origin sin CORS: no se puede leer su contenido
        // ni status, pero sí guardarlas y reproducirlas igual offline).
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Promise.reject('offline-sin-cache')))
  );
});
