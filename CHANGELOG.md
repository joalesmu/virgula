# Cambios

## Ajuste de controles · compilación interna 1.3.4 · 26 de noviembre de 2026

- El botón circular principal ahora inicia la grabación y cambia a **Detener** cuando la captura está activa. Mantiene la misma rutina de cierre y guardado que el botón independiente.
- Se conserva **Detener** en la barra flotante para que siga disponible al desplazarse por la lista de trabajo.
- Los dos accesos comparten un bloqueo contra dobles pulsaciones y se habilitan de nuevo si falla el cierre, para permitir un reintento.
- El nombre accesible del botón principal se actualiza junto con su acción.

## 1.0.0 · Primera versión pública · 25 de noviembre de 2026

Primera publicación abierta al público. Reúne las funciones desarrolladas y revisadas antes del lanzamiento:

- Grabación en un toque, audio de archivo WAV y audio de consulta cuando el navegador lo permite; pausa, marcas independientes **Siguiente** y **Repetir**, recuperación de fragmentos y registro de interrupciones.
- Listas de trabajo independientes, en modalidad de elementos o guion; importación y exportación TXT, visualización durante la grabación y asociación de elementos con clips.
- Seis plantillas de ficha de fábrica, selector individual, vista previa, edición, duplicación, importación, exportación y archivado. Las fichas conservan la definición histórica de su plantilla.
- Fichas con consentimiento, firma en pantalla, consentimiento oral, adjuntos, enlaces, participantes, transcripciones, traducciones, fuentes y clips.
- Exportación e importación ZIP con fichas JSON/CSV/HTML, audio, clips, adjuntos, listas TXT y formatos Broadcast WAV, Dublin Core, Darwin Core y ELAN.
- Almacenamiento local en IndexedDB y OPFS, recuperación ante interrupciones, avisos de respaldo y reporte técnico sin incluir audios ni fichas.
- Interfaz traducible, paquetes de idioma instalables, prueba de traducciones y catálogo de idiomas publicados.
- Accesibilidad con ajustes de tamaño, tema claro y oscuro, alto contraste y movimiento reducido; diseño adaptable a diferentes tamaños de pantalla.
- Instalación como PWA, uso sin conexión y comprobación automática y manual de actualizaciones.

## Hitos de desarrollo previos al lanzamiento (versiones internas, no publicadas)

- **Etapa inicial:** prueba técnica de grabación en Android y consolidación del almacenamiento local.
- **Accesibilidad e iOS/iPadOS:** ajustes de letra, tema claro, alto contraste, movimiento reducido, vibración opcional, formato de consulta compatible con dispositivos Apple e instrucciones de instalación.
- **Navegación y adjuntos:** integración del botón atrás, visualización de archivos adjuntos dentro de la aplicación y orientación para transferir grabaciones entre Safari y la aplicación instalada.
- **Estabilidad de audio:** respaldo temporal, recuperación de fragmentos, control de cierre de sesión, continuidad temporal y validación de integridad antes de exportar.
- **Organización del trabajo:** listas independientes, plantillas con definición histórica, exportación de listas y mejoras de actualización de la PWA.
- **Renovación visual:** identidad de cuaderno de campo sonoro, navegación simplificada y controles de grabación más claros.

Las etiquetas internas de desarrollo no representan versiones públicas anteriores. La primera versión publicada es 1.0.0.
