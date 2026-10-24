# Contribuir a Vírgula

Gracias por ayudar. Toda propuesta pasa por revisión antes de publicarse.

## Traducciones de la interfaz
1. En Vírgula: ⚙️ Ajustes → 🌐 Idioma → ✍️ Traducir Vírgula → ⬇️ Descargar plantilla.
2. Llena la columna `traduccion` (Google Sheets, Excel o LibreOffice) y los datos de arriba (`@codigo`, `@nombre`, `@traductores`, `@avala`…). Guarda como CSV.
3. 📥 Probar mi traducción para verla en la app.
4. 📨 Enviar traducción: por correo (joalesmu@gmail.com) o en GitHub (Issues → arrastra el archivo).

Conserva igual lo que está entre llaves (`{n}`, `{nombre}`…) y los `**dobles asteriscos**`. Si falta un texto, se verá en español: una traducción parcial ya sirve.

## Plantillas de ficha
Exporta tu plantilla (⬇️ Exportar en la lista de plantillas) y envíala igual que una traducción, explicando para qué sirve.

## Código
Edita los archivos de `src/`, ejecuta `python3 construir.py` y las pruebas de `pruebas/`. Todo texto visible va dentro de `t('…')`, `tH('…')` o `N_('…')` (o con `data-t` en el HTML) para que sea traducible.

## Licencia de las contribuciones
Al enviar una traducción, plantilla o cambio, aceptas que se publique bajo la misma licencia del proyecto (AGPL-3.0, con los términos de NOTICE.md), con crédito a quienes lo hicieron (en traducciones: el campo `@traductores` y, si la hay, la comunidad que avala). Las comunidades conservan sus derechos sobre sus lenguas y conocimientos: una traducción avalada por una comunidad se publica con su aval y puede retirarse si la comunidad lo pide.
