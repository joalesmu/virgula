# Vírgula · memoria sonora viva

Grabadora de campo gratuita: graba en un toque, documenta cada sonido con su ficha y exporta audios y fichas para archivos, bases de datos e investigaciones. Funciona sin conexión en Android, Windows y Mac (Chrome o Edge).

> En los códices mesoamericanos, la **vírgula** es la voluta que sale de la boca de alguien para indicar que habla. Todo sonido viene de alguien.

**Estado:** etapa 1, el núcleo (versión `1.0-etapa1`), en piloto.

## Qué hace
- **Grabar en un toque.** Dos calidades a la vez del mismo micrófono: *archivo* (WAV de 16 bits, sin alterar) y *consulta* (ligera, con volumen ajustado solo en ella). Marcas durante la grabación: 1 toque = siguiente clip; 2 toques = «otra vez» (descarta ese intento). Se guarda cada 2 s: si la app se cierra, se recupera lo grabado.
- **Ficha después, con calma.** Título, descripción, fecha, uso, lugar, ubicación opcional (exacta o aproximada), lenguas, participantes con rol, transcripción, traducciones, fuentes, derechos, notas y modo confidencial. Los textos largos admiten enlaces `[palabras](adjunto)` o `[palabras](https://…)`.
- **Consentimiento:** estado, forma y condiciones; firma con el dedo, grabación oral o documento adjunto.
- **Adjuntos** de cualquier tipo (fotos, Word, PDF, letras, materiales), cada uno con su papel y una nota.
- **Clips** cortados por las marcas, con etiqueta, texto y traducción; se pueden ajustar o agregar a mano.
- **Exportar** una o varias grabaciones en un `.zip`, eligiendo audios, clips y adjuntos, con el tamaño estimado y por dónde conviene enviarlo.
- **Importar** un paquete en otro aparato.

## El paquete exportado
| Archivo | Qué es |
|---|---|
| `indice.html` | Las fichas para leer y escuchar sin Vírgula |
| `fichas.json` | Todos los datos (lo que lee Vírgula al importar) |
| `fichas.csv`, `clips.csv` | Tablas para Excel, LibreOffice o Sheets |
| `audios/` | `.wav` (archivo) y `.webm`/`.m4a` (consulta) |
| `clips/` | `etiqueta__código-número.wav` y `.ogg`: el catálogo de lenguas los reconoce con «📥 Traer audios en lote» |
| `adjuntos/` | Una carpeta por grabación |

## Archivos del repositorio
| Archivo | Qué es |
|---|---|
| `index.html` | La app completa, en un solo archivo (generado) |
| `src/` | El código por partes; `python3 construir.py` las une en `index.html` |
| `manifest.webmanifest` | Nombre, íconos y colores para instalarla |
| `sw.js` | Guarda la app para abrir sin internet. **Al publicar cambios, cambia `VERSION`**: la app avisa «Hay una versión nueva» |
| `icono-*.png`, `apple-touch-icon.png` | Íconos |

Todo queda en el aparato: la app no envía nada a ningún lado. El respaldo es responsabilidad de quien graba (📦 Exportar).

## Licencia
© 2026 Alejandro Estrada. Diseñado y desarrollado por Alejandro Estrada.
Software libre bajo **AGPL-3.0**, con el término adicional de conservar visible el crédito de autoría y marcar las versiones modificadas (ver [NOTICE.md](NOTICE.md)). Las grabaciones y fichas pertenecen a quienes las hacen y a quienes aparecen en ellas.
