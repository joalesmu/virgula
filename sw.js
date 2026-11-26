
/*
 * Vírgula · memoria sonora viva
 * Service Worker de la versión pública 1.0.0
 * Compilación interna 1.3.2
 * Copyright (c) 2026 Alejandro Estrada
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Al publicar una versión nueva:
 * 1. Cambia VERSION en este archivo.
 * 2. Cambia VERSION en index.html.
 * 3. Publica ambos archivos juntos.
 */

const VERSION = 'virgula-1.0.0-build-1.3.2';
const PREFIJO_CACHE = 'virgula-';

// Rutas relativas al alcance del Service Worker.
// Funcionan también en GitHub Pages.
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

    // La instalación solo termina cuando todos los recursos
    // esenciales están guardados.
    // Si alguno falla, el navegador conserva activo el anterior.
    await cache.addAll(solicitudes);
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();

    // Eliminar únicamente versiones anteriores de la caché
    // de Vírgula. No tocar cachés de otras aplicaciones.
    await Promise.all(
      nombres
        .filter(nombre =>
          nombre.startsWith(PREFIJO_CACHE) &&
          nombre !== VERSION
        )
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

  // No interceptar otros dominios ni rutas ajenas a Vírgula.
  if (
    url.origin !== alcance.origin ||
    !url.href.startsWith(alcance.href)
  ) return;

  // Las consultas no-store deben llegar al servidor.
  // Por ejemplo, los catálogos de idiomas publicados.
  if (solicitud.cache === 'no-store') {
    evento.respondWith(fetch(solicitud));
    return;
  }

  evento.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const guardada = await cache.match(solicitud);

    // La aplicación abre desde la caché cuando está disponible.
    if (guardada) return guardada;

    try {
      return await fetch(solicitud);
    } catch (error) {
      // Solo las navegaciones pueden recibir index.html
      // como alternativa cuando no hay conexión.
      if (solicitud.mode === 'navigate') {
        const indice = await cache.match(
          new URL('./index.html', alcance).href
        );

        if (indice) return indice;
      }

      throw error;
    }
  })());
});

// El HTML envía este mensaje cuando la persona acepta
// instalar la actualización.
self.addEventListener('message', evento => {
  const mensaje = evento.data;

  if (
    mensaje === 'saltar' ||
    (mensaje && mensaje.tipo === 'saltar')
  ) {
    self.skipWaiting();
  }
});
