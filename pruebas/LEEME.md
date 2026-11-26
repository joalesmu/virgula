# Pruebas automatizadas de Vírgula 1.0.0

Estas pruebas de extremo a extremo usan Playwright y Chromium. La versión pública esperada es `1.0.0`; las pruebas también comprueban que el Service Worker y el HTML tengan la misma compilación interna (`1.3.2`).

## Requisitos

- Node.js.
- Playwright y Chromium.
- Python 3 para levantar un servidor HTTP local.
- El repositorio completo, incluidos `index.html`, `sw.js`, `manifest.webmanifest`, los iconos y la carpeta `idiomas/`.

Desde la raíz del repositorio, instala las dependencias una sola vez:

```bash
npm install --save-dev playwright
npx playwright install chromium
```

Si el repositorio genera `index.html` desde archivos fuente, ejecuta primero:

```bash
python3 construir.py
```

Si ya tienes el `index.html` compilado y actualizado, no necesitas reconstruirlo.

## Ejecutar

Abre una terminal en la raíz del repositorio y levanta el servidor:

```bash
python3 -m http.server 8765
```

En otra terminal, ejecuta las pruebas en este orden:

```bash
node pruebas/prueba_nucleo.js
node pruebas/prueba_plantillas_estandares_idioma.js
node pruebas/prueba_ingles.js
node pruebas/prueba_accesibilidad_iphone.js
node pruebas/prueba_atras_adjuntos.js
node pruebas/prueba_listas_actualizaciones.js
```

También puedes ejecutar una sola prueba para aislar un fallo. Todas usan `http://localhost:8765/` como dirección base.

## Qué comprueba cada prueba

- `prueba_nucleo.js`: versión pública e interna, grabación PCM y de consulta, marcas con la acción independiente **Repetir**, clips, ficha, adjuntos, transcripción con enlaces, firma, ubicación, exportación ZIP, importación en otro contexto y borrado.
- `prueba_plantillas_estandares_idioma.js`: selector individual de plantillas, plantillas de fábrica, duplicación, campos propios, campos obligatorios, plantillas fijas, vista de solo lectura, estándares Dublin Core, Darwin Core, BWF y ELAN, recordatorio de respaldo, informe técnico y flujo de traducción.
- `prueba_ingles.js`: descarga e instalación del idioma publicado, traducción de la pestaña Listas y de los controles **Siguiente** y **Repetir**, grabación, ficha y créditos de traducción.
- `prueba_accesibilidad_iphone.js`: tamaño de letra, temas claro y alto contraste, reducción de movimiento, instrucciones de instalación para iPhone y presentación móvil simulada.
- `prueba_atras_adjuntos.js`: navegación con el botón atrás durante la grabación, retorno desde la ficha y apertura de adjuntos dentro de la aplicación.
- `prueba_listas_actualizaciones.js`: coordinación entre versión HTML y Service Worker, botón de comprobación manual, creación y pegado de listas, normalización de viñetas, exportación TXT, barra de grabación fija al desplazarse, vinculación de elementos con clips, repetición sin avanzar, instantánea de lista, guion, exportación ZIP e importación de la lista asociada.

## Alcance y límites

Las pruebas utilizan el micrófono simulado de Chromium. La prueba de iPhone cambia el agente de usuario y el tamaño de pantalla en Chromium; comprueba la interfaz y el flujo de captura simulado, **no** reproduce el comportamiento real de Safari ni valida la grabación de audio en iOS. Esa comprobación requiere un iPhone o iPad físico.

Las pruebas deben ejecutarse contra el mismo conjunto de archivos que se publicará. La prueba de inglés necesita que `idiomas/lista.json` y `idiomas/en.json` estén en el repositorio y correspondan al inventario actual de textos.
