# Pruebas

Requieren Node.js y Playwright (`npm i playwright`, con Chromium). Desde la carpeta del repositorio:

```
python3 construir.py
python3 -m http.server 8765 &
node pruebas/prueba_nucleo.js
node pruebas/prueba_plantillas_estandares_idioma.js
node pruebas/prueba_ingles.js
node pruebas/prueba_accesibilidad_iphone.js
```

Usan un micrófono simulado (tono de prueba de Chromium). Cubren: grabar con marcas, ficha, adjuntos, firma, ubicación, exportar e importar en otro aparato, borrar; plantillas (fábrica, editar, campos propios, obligatorios, fijas, importar), estándares (Dublin Core, Darwin Core, BWF, ELAN), recordatorio de respaldo, reporte de problemas y traducción de la interfaz (plantilla, prueba, seguridad, envío, idioma publicado), accesibilidad (letra, temas, movimiento) e interfaz de iPhone simulada (el audio real de Safari se prueba en un iPhone).
