# Contribuir a Vírgula

Gracias por ayudar. Toda propuesta pasa por revisión antes de publicarse. Las traducciones, plantillas y listas pueden ser útiles para otras personas, pero deben respetar el contexto, los derechos y las decisiones de las comunidades relacionadas.

## Traducciones de la interfaz

1. En Vírgula, abre **Ajustes → Idioma de la interfaz → Traducir Vírgula**.
2. Selecciona una traducción existente para mejorarla o una plantilla vacía para iniciar otra lengua.
3. Descarga la plantilla CSV y completa la columna `traduccion` en Google Sheets, Excel o LibreOffice.
4. Conserva las frases originales en `texto_original` y todas las variables entre llaves (`{n}`, `{nombre}`, `{error}`, etc.) exactamente como aparecen.
5. Prueba la traducción dentro de Vírgula. Revisa botones, mensajes, listas, fichas y pantallas pequeñas.
6. Usa **Enviar traducción** para generar el paquete. Puede enviarse por correo a `joalesmu@gmail.com` o mediante una propuesta en GitHub.

Una traducción parcial es bienvenida: los textos que falten se mostrarán en español. No se debe indicar 100 % de avance si quedan claves sin traducir.

### Criterios de traducción

- Prioriza expresiones breves, concretas y fáciles de interpretar.
- Describe la acción o el resultado; evita modismos, juegos de palabras y conceptos abstractos cuando una expresión directa sea más clara.
- No traduzcas palabra por palabra si la lengua utiliza una construcción diferente. Respeta la expresión natural y la variante correspondiente.
- Conserva los nombres de variables y la estructura funcional de los mensajes.
- Registra quién tradujo y, cuando corresponda, qué comunidad, autoridad o institución revisó y avaló la traducción.
- Una traducción no se considera avalada por una comunidad sin su revisión y autorización.

## Listas de trabajo

Las listas pueden compartirse como texto o archivo TXT desde la pestaña **Listas**. Al proponer una lista para el repositorio, explica su finalidad, lengua o variante cuando corresponda, fuente y condiciones de uso. No incluyas datos personales, vocabularios confidenciales ni materiales comunitarios sin autorización.

## Plantillas de ficha

En **Ajustes → Plantillas**, selecciona una plantilla en el desplegable y utiliza **Exportar**. Acompaña el archivo con una explicación de su propósito, campos obligatorios y contexto de uso. No incluyas datos personales reales en ejemplos.

## Código

- Edita los módulos de `src/`; sus prefijos numéricos determinan el orden de construcción.
- Todo texto visible debe marcarse con `t('…')`, `tH('…')`, `N_('…')` o atributos `data-t`, `data-tp` y `data-ta` para que pueda traducirse. Los mensajes de error que pueden llegar a la pantalla también deben pasar por `t()`.
- En etiquetas condicionales, traduce cada alternativa por separado: `condicion ? t('A') : t('B')`. No pases toda la expresión como argumento de `t()`, porque el constructor no puede extraer sus dos textos.
- Ejecuta `python3 construir.py` desde la raíz. El constructor genera `index.html` y `idiomas/textos_es.csv`.
- Ejecuta las pruebas automatizadas descritas en `pruebas/LEEME.md`.
- No edites manualmente el `TEXTOS_FUENTE` generado dentro de `index.html`; corrige las fuentes y vuelve a construir.
- Si cambia el Service Worker, actualiza su constante `VERSION` y coordínala con `BUILD_INTERNO` del código. Publica los archivos de una misma compilación juntos.

## Licencia y reconocimiento

Al enviar una traducción, plantilla, lista o cambio de código, aceptas que la contribución se distribuya bajo AGPL-3.0-only y los términos adicionales de [NOTICE.md](NOTICE.md), salvo que se acuerde expresamente otra cosa antes de incorporarla. Se conserva el crédito de autoría y, en traducciones, el crédito de quienes tradujeron y de la comunidad que avala cuando corresponda.

Las comunidades conservan sus derechos sobre sus lenguas y conocimientos. Una traducción o lista respaldada por una comunidad se publica con su autorización y puede retirarse si la comunidad lo solicita.
