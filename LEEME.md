# Idiomas de la interfaz de Vírgula

Esta carpeta reúne el inventario de textos de la interfaz y los paquetes de idioma que Vírgula puede instalar.

## Archivos

- `textos_es.csv`: inventario actual de los textos originales en español y de la sección donde aparecen. Se genera a partir de `TEXTOS_FUENTE` en `index.html` mediante `construir.py`. No es un paquete de idioma instalable.
- `lista.json`: catálogo de idiomas que la aplicación muestra en «Ver idiomas publicados».
- `<código>.json`: paquete de traducción de cada idioma, por ejemplo `en.json`.
- `LEEME.md`: estas instrucciones.

La versión pública de la aplicación y la versión de cada traducción son independientes. Una nueva versión de la app no obliga a que todos los idiomas estén terminados, pero sí requiere revisar sus claves.

## Cómo se mantiene el inventario

El texto original en español es la clave de traducción. La aplicación reúne sus textos marcados en `TEXTOS_FUENTE`, dentro de `index.html`.

Cuando se agrega, elimina o modifica un texto visible:

1. Actualiza `TEXTOS_FUENTE` con la frase exacta en español y la sección donde aparece.
2. Regenera `textos_es.csv` con `construir.py`.
3. Revisa las traducciones existentes. Una clave que cambió, aunque sea por puntuación, mayúsculas o espacios, se considera un texto distinto.
4. Actualiza los paquetes de idioma y su versión cuando corresponda.

El CSV debe contener una fila por texto original. Si una misma frase aparece en más de una sección, conserva una sola fila y señala la primera sección donde se utiliza. Para traducir, usa la plantilla descargada desde la propia aplicación: incluye las columnas y los datos de versión que Vírgula necesita.

## Cómo preparar o actualizar una traducción

1. Abre Vírgula y entra en **Ajustes → Idioma de la interfaz**.
2. En «Traducir Vírgula a otra lengua», selecciona el idioma instalado que servirá como base o una plantilla nueva.
3. Descarga la plantilla CSV. Puedes trabajar en Google Sheets, Excel o LibreOffice.
4. Escribe las traducciones en la columna `traduccion`. Puedes avanzar poco a poco; los textos que falten se mostrarán en español.
5. Conserva exactamente los nombres de las claves en `texto_original`.
6. Conserva todas las variables entre llaves, por ejemplo `{nombre}`, `{n}` o `{error}`. No las traduzcas, elimines ni cambies.
7. Prueba el CSV en Vírgula con «Probar mi traducción». Revisa las pantallas y los mensajes antes de preparar el paquete JSON.
8. Usa «Enviar traducción» para generar el archivo `virgula-idioma-<código>-v<n>.json`.

También se puede instalar un paquete JSON desde **Ajustes → Instalar idioma desde archivo** para revisarlo directamente en la aplicación.

## Criterios de traducción

- Usa expresiones breves, directas y fáciles de interpretar.
- Prioriza describir la acción o el resultado. Evita modismos, juegos de palabras y conceptos abstractos cuando una expresión concreta sea más clara.
- Mantén consistentes los nombres de acciones, secciones y controles.
- En lenguas originarias, la traducción debe respetar la forma natural de expresar cada acción en la lengua y su variante. No fuerces una traducción palabra por palabra del español.
- Cuando sea posible, pide la revisión de hablantes y de la comunidad correspondiente. Registra quién tradujo y quién revisó en los metadatos del paquete.
- Comprueba la interfaz en el tamaño de pantalla habitual de quienes la utilizarán. Una frase correcta puede resultar demasiado larga para un botón.

## Publicar un idioma

1. Revisa el paquete `virgula-idioma-<código>-v<n>.json` en Vírgula.
2. Guarda la versión aprobada en esta carpeta como `<código>.json` (por ejemplo, `hch.json` o `en.json`).
3. Actualiza la entrada correspondiente en `lista.json`:
   - `codigo`: código de idioma;
   - `nombre`: nombre del idioma;
   - `version`: debe coincidir con el campo `version` del paquete;
   - `archivo`: nombre del archivo JSON;
   - `avance`: porcentaje aproximado de textos traducidos.
4. Si reemplazas una traducción existente, incrementa su `version`. La versión del paquete de idioma es independiente de la versión pública de Vírgula.
5. Publica juntos el paquete JSON y `lista.json`. La aplicación consulta `idiomas/lista.json` y descarga el archivo indicado.

Quien ya tenga instalada una traducción verá la opción «Actualizar» cuando la versión publicada sea mayor que la instalada.

## Formato del paquete

Un paquete utiliza el formato `virgula-idioma-1` e incluye estos metadatos:

- `codigo`, `nombre`, `nombreEs`, `variante` y `locale`;
- `traductores`, `avala`, `licencia` y `contacto`;
- `version`;
- `textos`, un objeto cuyas claves son las frases exactas en español y cuyos valores son las traducciones.

No cambies el valor de `formato`. El campo `version` identifica la revisión del paquete de idioma, no la versión de la aplicación.

## Estado del paquete inglés

`en.json` corresponde al idioma inglés (`en`, `en-US`). Su versión de traducción es la 6 y contiene 692 claves vigentes de un inventario de 763 textos (91 % de cobertura). Las claves antiguas que ya no aparecen en la interfaz se retiraron. La traducción sigue identificada como borrador para revisión; la cobertura de claves no equivale a una certificación lingüística o comunitaria.