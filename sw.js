// Service worker de EnOrden: guarda la app en el dispositivo para que abra sin conexión.
// Los datos (canciones, setlists, agenda) los guarda la propia app; acá solo van los archivos de la app.
const VERSION = 'enorden-9edf19f846';
const SHELL = [
  './', './index.html', './config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png','./icons/logo.svg',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' = pedir los archivos al servidor, no a la memoria del navegador
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

// Al activarse una versión nueva: borra la anterior y recarga las ventanas abiertas para que la usen enseguida.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => {
        const viejas = keys.filter((k) => k !== VERSION);
        return Promise.all(viejas.map((k) => caches.delete(k))).then(() => viejas.length > 0);
      })
      .then((actualizacion) => self.clients.claim().then(() => actualizacion))
      .then((actualizacion) => {
        if (!actualizacion) return;
        return self.clients.matchAll({ type: 'window' })
          .then((ws) => Promise.all(ws.map((w) => w.navigate(w.url).catch(() => {}))));
      })
  );
});

// Primero la red, siempre preguntando al servidor si hay algo nuevo (no-cache);
// si no hay conexión, lo guardado.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const red = req.mode === 'navigate'
    ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    : fetch(req, { cache: 'no-cache' });
  e.respondWith(
    red
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
        .then((hit) => hit || new Response('Sin conexión', { status: 503 })))
  );
});
