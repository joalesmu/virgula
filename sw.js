/* 
 * Vírgula · memoria sonora viva
 * Service Worker de la versión pública 1.0.0 (compilación interna 1.3.4)
 * Copyright (c) 2026 Alejandro Estrada
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Al publicar una versión nueva:
 * 1. Cambia VERSION en este archivo.
 * 2. Coordina BUILD_INTERNO en src/10_base.js.
 * 3. Ejecuta python3 construir.py y publica juntos index.html y sw.js.
 */

const VERSION = 'virgula-1.0.0-build-1.3.4';
const PREFIJO_CACHE = 'virgula-';

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icono-192.png',
  './icono-512.png',
  './icono-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const solicitudes = ARCHIVOS.map(ruta =>
      new Request(new URL(ruta, self.registration.scope).href, {
        cache: 'reload',
        credentials: 'same-origin'
      })
    );
    await cache.addAll(solicitudes);
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(
      nombres
        .filter(nombre => nombre.startsWith(PREFIJO_CACHE) && nombre !== VERSION)
        .map(nombre => caches.delete(nombre))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', evento => {
  const solicitud = evento.request;
  if (solicitud.method !== 'GET') return;

  const url = new URL(solicitud.url);
  const alcance = new URL(self.registration.scope);
  if (url.origin !== alcance.origin || !url.href.startsWith(alcance.href)) return;

  if (solicitud.cache === 'no-store') {
    evento.respondWith(fetch(solicitud));
    return;
  }

  evento.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const guardada = await cache.match(solicitud);
    if (guardada) return guardada;

    try {
      return await fetch(solicitud);
    } catch (error) {
      if (solicitud.mode === 'navigate') {
        const indice = await cache.match(new URL('./index.html', alcance).href);
        if (indice) return indice;
      }
      throw error;
    }
  })());
});

self.addEventListener('message', evento => {
  const mensaje = evento.data;
  if (mensaje === 'saltar' || (mensaje && mensaje.tipo === 'saltar')) {
    self.skipWaiting();
  }
});
