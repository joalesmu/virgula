# Vírgula · memoria sonora viva

**Primera versión pública: 1.0.0** · [Abrir Vírgula](https://joalesmu.github.io/virgula/)

Grabadora de campo gratuita para registrar sonidos, documentar su contexto y conservar audios y fichas. Funciona sin conexión después de cargar e instalar la aplicación. Está pensada para celulares, tabletas y computadoras, en navegadores compatibles.

> En los códices mesoamericanos, la **vírgula** es la voluta que sale de la boca de alguien para indicar que habla. Todo sonido viene de alguien.

## Qué permite hacer

- **Grabar y documentar.** Captura audio de archivo en WAV de 16 bits y audio ligero de consulta cuando el navegador lo permite. La grabación se guarda por fragmentos y registra interrupciones detectadas.
- **Usar marcas y listas.** Los controles **Siguiente** y **Repetir** son independientes. Las listas pueden contener elementos breves —por ejemplo, palabras o frases— o un guion completo. Se muestran debajo de los controles de grabación; en modalidad de elementos, los clips pueden conservar la relación con cada entrada.
- **Preparar listas de trabajo.** Crea listas, pega texto, importa o exporta TXT y reutilízalas en distintas sesiones. La grabación conserva una copia de la lista utilizada.
- **Completar fichas con plantillas.** Hay seis plantillas de fábrica. Se elige una desde un selector en Ajustes; se puede consultar, usar en nuevas grabaciones, editar, duplicar, exportar o archivar. Las fichas conservan la definición de plantilla con la que se crearon.
- **Registrar consentimiento.** Anota su estado, forma y condiciones; admite firma en pantalla, consentimiento oral grabado o documento adjunto.
- **Agregar materiales.** Adjunta fotos, audio, video, PDF y otros archivos, con papel y nota. Los textos largos admiten enlaces a adjuntos o páginas web.
- **Crear clips.** Corta segmentos por marcas o manualmente y añade etiquetas, texto y traducciones. Las listas de elementos pueden vincularse con los clips.
- **Exportar e importar.** Prepara paquetes ZIP con fichas, audios, clips, adjuntos, copias TXT de las listas utilizadas y formatos para archivo e investigación: Broadcast WAV, Dublin Core, Darwin Core y ELAN.
- **Proteger y recuperar el trabajo.** Mantiene los datos localmente, intenta recuperar grabaciones interrumpidas y recuerda cuándo falta crear un respaldo exportado. La aplicación no sube grabaciones ni fichas a un servidor.
- **Actualizar la aplicación.** Detecta versiones nuevas y ofrece una comprobación manual desde Ajustes → Acerca de. La actualización no debe interrumpir una grabación en curso.
- **Usar herramientas de accesibilidad.** Permite ajustar tamaño de letra, tema claro u oscuro, alto contraste y movimiento reducido; la interfaz se adapta a celulares, tabletas y computadoras.
- **Traducir la interfaz.** Admite paquetes de idioma instalables. Las traducciones pueden prepararse en una hoja de cálculo y probarse en la propia aplicación.

## El paquete exportado

| Archivo o carpeta | Contenido |
|---|---|
| `indice.html` | Fichas para consultar y escuchar sin tener Vírgula instalada. |
| `fichas.json` | Datos completos de las grabaciones, sus plantillas históricas y listas asociadas. |
| `fichas.csv`, `clips.csv` | Tablas para Excel, LibreOffice o Google Sheets. |
| `audios/` | Audio completo de archivo y/o de consulta, según las opciones elegidas. |
| `clips/` | Archivos de audio de los clips seleccionados. |
| `listas/` | Copias TXT de las listas de trabajo utilizadas. |
| `adjuntos/` | Archivos adjuntos organizados por grabación. |
| `estandares/` | Dublin Core y, cuando corresponde, Darwin Core. |
| `elan/` | Archivos `.eaf` con clips y transcripción alineados. |

Los WAV pueden incluir metadatos Broadcast WAV (`bext` y `LIST/INFO`). Los campos propios de una plantilla pueden asociarse con términos de Dublin Core o Darwin Core.

## Traducir la interfaz

Consulta [idiomas/LEEME.md](idiomas/LEEME.md). La interfaz utiliza las frases en español como claves. Las traducciones deben conservar exactamente esas claves y todas las variables entre llaves, por ejemplo `{nombre}` o `{n}`. En las lenguas originarias se debe priorizar una expresión natural, concreta y fácil de interpretar, no una traducción palabra por palabra.

El paquete inglés incluido es un borrador y no sustituye la revisión de hablantes ni la validación lingüística.

## Archivos del repositorio

| Archivo o carpeta | Función |
|---|---|
| `index.html` | Aplicación completa generada para publicar. |
| `src/` | Fuentes modulares HTML y JavaScript. Su orden se determina por el prefijo numérico. |
| `construir.py` | Une `src/`, genera `index.html` y actualiza `idiomas/textos_es.csv`. |
| `idiomas/` | Inventario de textos y paquetes de idioma publicados. |
| `pruebas/` | Pruebas automatizadas con Playwright y Chromium. |
| `manifest.webmanifest`, `sw.js` | Instalación como PWA, caché y uso sin conexión. |
| `icono-192.png`, `icono-512.png`, `icono-maskable-512.png`, `apple-touch-icon.png` | Iconos de la aplicación. |
| `CONTRIBUIR.md` | Instrucciones para aportar traducciones, listas, plantillas o código. |
| `LICENSE`, `NOTICE.md` | Licencia AGPL-3.0 y términos adicionales de atribución. |

## Desarrollo y construcción

Desde la raíz del repositorio, con Python 3:

```bash
python3 construir.py
```

El constructor ordena los archivos de `src/` por nombre, reúne los textos traducibles, produce `index.html` y regenera `idiomas/textos_es.csv`. Después de construir, ejecuta las pruebas indicadas en [pruebas/LEEME.md](pruebas/LEEME.md).

Al publicar una versión nueva, coordina la versión pública en `src/10_base.js`, la compilación interna `BUILD_INTERNO` y la constante `VERSION` de `sw.js`. Publica juntos `index.html`, `sw.js`, `manifest.webmanifest`, los iconos y las carpetas `idiomas/` y `src/` actualizadas.

## Responsabilidad y privacidad

Vírgula conserva las grabaciones y fichas en el almacenamiento del aparato. No las carga a un servidor. La persona que graba debe revisar el consentimiento, las condiciones de uso, el acceso al dispositivo y los respaldos exportados. La persistencia local depende del navegador y del espacio disponible; exporta respaldos periódicamente.

## Licencia y autoría

© 2026 Alejandro Estrada. **Diseñado y desarrollado por Alejandro Estrada.**

Software libre bajo **AGPL-3.0-only**, con los términos adicionales de atribución y marcado de versiones modificadas descritos en [NOTICE.md](NOTICE.md). Las grabaciones, fichas, fotografías y demás materiales creados con Vírgula pertenecen a quienes los registran y a las personas y comunidades que aparecen en ellos, según sus acuerdos.
