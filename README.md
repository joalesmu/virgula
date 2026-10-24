# Vírgula · memoria sonora viva

Grabadora de campo gratuita: graba en un toque, documenta cada sonido con su ficha y exporta audios y fichas para archivos, bases de datos e investigaciones. Funciona sin conexión en Android, Windows y Mac (Chrome o Edge) y se instala como app desde el navegador.

> En los códices mesoamericanos, la **vírgula** es la voluta que sale de la boca de alguien para indicar que habla. Todo sonido viene de alguien.

**Versión:** 1.0 · **Abrir:** https://joalesmu.github.io/virgula/

## Qué hace
- **Grabar en un toque.** Dos calidades a la vez del mismo micrófono: *archivo* (WAV de 16 bits, sin alterar) y *consulta* (ligera, con volumen ajustado solo en ella). Marcas mientras se graba: 1 toque = siguiente clip; 2 toques = «otra vez». Guarda cada 2 s; si la app se cierra, se recupera lo grabado. Detecta y anota los tramos sin audio (llamadas) y los huecos.
- **Ficha guiada por plantillas.** Seis de fábrica (General, Lengua, Patrimonio y celebraciones, Bitácora de campo, Sonidos de la naturaleza, Entrevista o sesión de investigación). Cada campo se puede renombrar, ocultar, reordenar o volver obligatorio; se agregan campos propios (texto, número, fecha, listas, sí/no). El núcleo que nunca se quita: título, fecha y consentimiento. Las plantillas se exportan e importan; una plantilla **fija** de equipo se usa tal cual.
- **Consentimiento:** estado, forma y condiciones; firma con el dedo, grabación oral o documento adjunto.
- **Adjuntos** de cualquier tipo, con papel y nota; **enlaces** dentro de los textos largos: `[palabras](adjunto)` o `[palabras](https://…)`.
- **Clips** cortados por las marcas, con etiqueta, texto y traducción.
- **Exportar** una o varias grabaciones en `.zip`, eligiendo audios, clips y adjuntos, con el tamaño estimado y por dónde conviene enviarlo. **Importar** paquetes en otro aparato (trae también sus plantillas).
- **Recordatorio de respaldo** (a los 3 días por defecto) y **📨 Reportar un problema** (informe técnico sin audios ni fichas).
- **Interfaz traducible** a cualquier lengua: se instala un idioma desde archivo o desde los publicados aquí; cualquier persona puede traducir con una hoja de cálculo y probar su traducción al momento.

## El paquete exportado
| Archivo | Qué es |
|---|---|
| `indice.html` | Las fichas para leer y escuchar sin Vírgula |
| `fichas.json` | Todos los datos y las plantillas usadas (lo que lee Vírgula al importar) |
| `fichas.csv`, `clips.csv` | Tablas para Excel, LibreOffice o Sheets (incluye los campos propios) |
| `audios/` | `.wav` (archivo) y `.webm`/`.m4a` (consulta) |
| `clips/` | `etiqueta__código-número.wav` y `.ogg`: el catálogo de lenguas los reconoce con «📥 Traer audios en lote» |
| `adjuntos/` | Una carpeta por grabación |
| `estandares/dublin_core.xml` | Dublin Core (OAI-DC), una ficha por grabación |
| `estandares/darwin_core/` | `occurrence.csv` + `meta.xml` (archivo Darwin Core para GBIF/SNIB), solo si hay grabaciones de naturaleza |
| `elan/*.eaf` | Clips y transcripción alineados al audio, para ELAN |

Los WAV llevan dentro título, fecha, código, autoría y derechos (**Broadcast WAV**: bloques `bext` y `LIST/INFO`). Los campos propios de una plantilla pueden declararse equivalentes a términos de Dublin Core o Darwin Core.

## Traducir la interfaz
Ver [idiomas/LEEME.md](idiomas/LEEME.md). En resumen: ⚙️ Ajustes → 🌐 Idioma → ✍️ Traducir Vírgula → descargar plantilla → llenar en una hoja de cálculo → probar → enviar por correo o GitHub.

## Archivos del repositorio
| Archivo | Qué es |
|---|---|
| `index.html` | La app completa, en un solo archivo (generado) |
| `src/` | El código por partes; `python3 construir.py` las une en `index.html` y reúne los textos traducibles |
| `idiomas/` | Idiomas publicados (`lista.json`, `en.json`…) y `textos_es.csv` con todos los textos |
| `pruebas/` | Pruebas automáticas (Playwright, micrófono simulado) |
| `manifest.webmanifest`, `sw.js` | Instalación y uso sin conexión. **Al publicar cambios, cambia `VERSION` en `sw.js`**: la app avisa «Hay una versión nueva» |
| `CONTRIBUIR.md` | Cómo proponer traducciones, plantillas o cambios |

## Responsabilidad
Vírgula guarda todo solo en el aparato y no sube nada a internet. Cuidar el acceso al aparato y a los archivos exportados, y respaldar, es responsabilidad de quien graba.

## Licencia
© 2026 Alejandro Estrada. Diseñado y desarrollado por Alejandro Estrada.
Software libre bajo **AGPL-3.0**, con el término adicional de conservar visible el crédito de autoría y marcar las versiones modificadas (ver [NOTICE.md](NOTICE.md)). Las grabaciones y fichas pertenecen a quienes las hacen y a quienes aparecen en ellas.
