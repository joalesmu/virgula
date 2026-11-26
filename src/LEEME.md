# Código fuente modular de Vírgula 1.0.0

Esta carpeta corresponde al `index.html` público 1.0.0 y a la compilación interna 1.3.2 entregada junto con ella. Los módulos se extrajeron de esa compilación para mantener el código fuente modular sincronizado con la aplicación publicada.

## Archivos y orden

1. `00_head.html` — metadatos y estilos.
2. `01_body.html` — estructura HTML de la interfaz.
3. `05_idioma.js` — traducción, lectura de CSV y textos de interfaz.
4. `10_base.js` — utilidades, IndexedDB, OPFS, ajustes, almacenamiento y navegación.
5. `20_audio.js` — captura, grabación, marcas, listas vinculadas a clips y recuperación de sesiones.
6. `25_medios.js` — fragmentos, continuidad temporal, PCM, WAV y audio de consulta.
7. `30_acervo.js` — acervo y recordatorios de respaldo.
8. `35_plantillas.js` — plantillas y su administración.
9. `38_listas.js` — listas de trabajo, edición, importación y asociación con grabaciones.
10. `40_ficha.js` — fichas, adjuntos, consentimiento y clips.
11. `50_export.js` — ZIP, CSV, índice autónomo y exportación de listas.
12. `55_estandares.js` — Broadcast WAV, Dublin Core, Darwin Core y ELAN.
13. `60_import.js` — lectura e importación de paquetes.
14. `70_init.js` — eventos, inicialización y actualizaciones del Service Worker.

## Construcción

El HTML final se compone en este orden: `00_head.html`, `01_body.html`, apertura de `<script>`, módulos JavaScript en el orden anterior y cierre de `</script></body></html>`.

`TEXTOS_FUENTE` no se incluye manualmente en `05_idioma.js`: es una tabla generada por `construir.py` a partir de los textos marcados en HTML y JavaScript. No la edites a mano.

**Importante sobre `construir.py`:** el archivo del constructor no se incluyó en los adjuntos de esta revisión, por lo que no pude comprobar su lista interna de módulos. Se añadió `38_listas.js` para mantener separado el módulo de listas. Si el constructor enumera los archivos JavaScript explícitamente, agrega `38_listas.js` después de `35_plantillas.js` y antes de `40_ficha.js`. Si descubre automáticamente los `.js` ordenados por nombre, no requiere ese ajuste.

Después de construir, compara la versión generada con el `index.html` de esta misma entrega y ejecuta las pruebas de `pruebas/`. No publiques una compilación si se omitió `38_listas.js`.

## Versiones

- Versión pública: `1.0.0`.
- Compilación interna correspondiente: `1.3.2`.
- Service Worker coordinado: `virgula-1.0.0-build-1.3.2`.
