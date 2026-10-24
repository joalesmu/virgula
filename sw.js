/* Vírgula · service worker: guarda la app en el aparato para que abra sin internet.
   Copyright (c) 2026 Alejandro Estrada · SPDX-License-Identifier: AGPL-3.0-only
   Al publicar una versión nueva, cambia VERSION: así el aparato descarga la nueva y avisa. */
const VERSION = 'virgula-1.1';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './icono-192.png', './icono-512.png', './icono-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Primero lo guardado (abre al instante, aunque la señal sea mala); la versión nueva llega con un cambio de VERSION.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

// La página pide activar la versión nueva cuando la persona toca «Actualizar ahora»
self.addEventListener('message', e => { if (e.data === 'saltar') self.skipWaiting(); });
