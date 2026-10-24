# Idiomas de la interfaz

- `textos_es.csv`: todos los textos de Vírgula en español, con dónde aparecen (lo genera `construir.py`).
- `lista.json`: los idiomas publicados que la app ofrece en «🔄 Ver idiomas publicados».
- `<código>.json`: cada idioma (por ejemplo `en.json`).

## Publicar un idioma recibido
1. Revisa el archivo `virgula-idioma-<código>-v<n>.json` (abrirlo en la app con «📥 Instalar idioma desde archivo» es la forma más rápida de revisarlo).
2. Guárdalo aquí como `<código>.json`.
3. Agrégalo o actualízalo en `lista.json`: `{ "codigo": "hch", "nombre": "Wixárika", "version": 1, "archivo": "hch.json", "avance": 80 }`.
4. Sube los cambios. En la app aparece al tocar «🔄 Ver idiomas publicados»; quien lo tenga instalado verá «⬆️ Actualizar» cuando suba la versión.

Los textos clave son el español exacto. Si un texto cambia en una versión nueva de Vírgula, su traducción anterior deja de aplicarse y ese texto se ve en español hasta que se actualice la traducción (la plantilla «Mejorar: …» muestra qué falta).
