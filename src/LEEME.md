# Código fuente modular de Vírgula 1.0.0

Esta carpeta contiene las fuentes que generan el `index.html` público. El identificador de esta compilación interna es `1.3.4`; no representa una versión pública independiente.

## Archivos y orden de carga

1. `00_head.html` — metadatos y estilos.
2. `01_body.html` — estructura HTML y navegación.
3. `05_idioma.js` — traducción y textos de interfaz.
4. `10_base.js` — utilidades, IndexedDB (versión 2), OPFS, ajustes y navegación.
5. `20_audio.js` — captura, grabación, marcas y recuperación.
6. `25_medios.js` — fragmentos, continuidad temporal, PCM y WAV.
7. `30_acervo.js` — acervo y recordatorios.
8. `35_plantillas.js` — plantillas de ficha.
9. `38_listas.js` — listas de trabajo y asociación con grabaciones.
10. `40_ficha.js` — fichas, adjuntos, consentimiento y clips.
11. `50_export.js` — paquetes ZIP y formatos tabulares.
12. `55_estandares.js` — Broadcast WAV, Dublin Core, Darwin Core y ELAN.
13. `60_import.js` — lectura e importación de paquetes.
14. `70_init.js` — eventos, inicialización y actualización del Service Worker.

Los prefijos numéricos determinan el orden. No renombres los archivos ni cambies ese orden sin revisar las dependencias.

## Construcción

Desde la raíz del repositorio ejecuta:

```bash
python3 construir.py
```

El constructor procesa únicamente archivos `.html` y `.js` de esta carpeta, en orden alfabético por nombre. Genera `index.html` y `idiomas/textos_es.csv`, con una fila por texto traducible. La tabla `TEXTOS_FUENTE` se genera automáticamente; no debe editarse a mano.

El constructor exige, entre otros, `00_head.html`, `01_body.html`, `05_idioma.js`, `10_base.js`, `38_listas.js` y `70_init.js`. Si se omite `38_listas.js`, la construcción se detiene.

## Versiones

- Versión pública: `1.0.0`.
- Compilación interna: `1.3.4`.
- Service Worker correspondiente: `virgula-1.0.0-build-1.3.4`.

Al preparar otro lanzamiento, actualiza `BUILD_INTERNO` en `10_base.js` y la constante `VERSION` en `sw.js`; luego construye de nuevo y ejecuta las pruebas.
