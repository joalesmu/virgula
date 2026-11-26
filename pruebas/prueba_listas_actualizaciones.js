const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = require('os').tmpdir();
const BASE = 'http://localhost:8765/';
const ok = (c, m) => {
  console.log((c ? '✔ ' : '✘ ') + m);
  if (!c) process.exitCode = 1;
};

(async () => {
  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const context = await browser.newContext({
    permissions: ['microphone'],
    acceptDownloads: true,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());

  try {
    await page.goto(BASE);
    await page.waitForFunction(() => typeof DB !== 'undefined' && typeof ListaTrabajo !== 'undefined', undefined, { timeout: 10000 });

    // ── Versión pública y comprobación manual de actualizaciones ──
    ok(await page.textContent('#version') === '1.0.0', 'versión pública 1.0.0');
    const swCoordinado = await page.evaluate(async () => {
      const sw = await fetch('./sw.js', { cache: 'no-store' }).then(r => r.text());
      return sw.includes(`virgula-${VERSION}-build-${BUILD_INTERNO}`);
    });
    ok(swCoordinado, 'la versión de index.html coincide con la caché de sw.js');
    await page.click('nav.abajo [data-vista="vAjustes"]');
    ok(await page.isVisible('#bComprobarActualizaciones'), 'botón manual de actualización visible');
    await page.click('#bComprobarActualizaciones');
    await page.waitForFunction(() => {
      const estado = document.querySelector('#estadoActualizaciones')?.textContent || '';
      return /Vírgula está actualizada|Hay una actualización lista|Se encontró una versión nueva|No se pudo comprobar|No se pudo registrar/.test(estado);
    }, undefined, { timeout: 10000 });
    const estadoActualizacion = await page.textContent('#estadoActualizaciones');
    ok(/Vírgula está actualizada|Hay una actualización lista|Se encontró una versión nueva/.test(estadoActualizacion),
      'comprobación manual responde correctamente: ' + estadoActualizacion.trim());

    // ── Crear una lista mediante texto pegado ──
    await page.click('nav.abajo [data-vista="vListas"]');
    await page.click('#bListaPegar');
    await page.fill('#impListaNombre', 'Vocabulario de prueba');
    await page.selectOption('#impListaTipo', 'elementos');
    await page.fill('#impListaTexto', 'maíz\n- tortilla\n3. frijol');
    await page.click('#impListaGuardar');
    await page.waitForTimeout(300);

    let lista = await page.evaluate(async () =>
      (await DB.todas('listas')).find(x => x.nombre === 'Vocabulario de prueba')
    );
    ok(!!lista, 'lista creada y guardada en IndexedDB');
    ok(lista && lista.elementos.map(x => x.texto).join('|') === 'maíz|tortilla|frijol',
      'viñetas y numeración se normalizan sin alterar las palabras');

    // Exportación TXT para compartir la lista fuera de Vírgula.
    const [txtDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#bListaExportar')
    ]);
    const txtPath = path.join(OUT, txtDownload.suggestedFilename());
    await txtDownload.saveAs(txtPath);
    const txt = fs.readFileSync(txtPath, 'utf8');
    ok(txt.split(/\r?\n/).join('|') === 'maíz|tortilla|frijol', 'exportación TXT conserva el contenido');

    // ── Seleccionar lista y grabar con ella ──
    await page.click('nav.abajo [data-vista="vGrabar"]');
    ok(await page.inputValue('#listaGrabacion') === lista.id, 'la lista creada queda seleccionada para grabaciones nuevas');
    ok(await page.isVisible('#listaLectura') && (await page.textContent('#listaLectura')).includes('maíz'),
      'la lista se muestra debajo de los controles de grabación');

    await page.click('#bGrabar');
    await page.waitForTimeout(1800);

    // Desplazarse hasta la lista; la barra de acciones debe permanecer accesible.
    await page.locator('#panelListaGrabacion').scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const barra = await page.evaluate(() => {
      const el = document.getElementById('barraControlesGrabacion');
      const r = el.getBoundingClientRect();
      return {
        position: getComputedStyle(el).position,
        top: r.top,
        bottom: r.bottom,
        alto: innerHeight,
        botones: ['bMarcar', 'bRepetirElemento', 'bPausa', 'bDetener'].map(id => {
          const b = document.getElementById(id).getBoundingClientRect();
          return b.top >= 0 && b.bottom <= innerHeight;
        })
      };
    });
    ok(barra.position === 'sticky' && barra.top >= 0 && barra.top < 40,
      'barra de grabación permanece arriba al consultar la lista');
    ok(barra.botones.every(Boolean), 'Siguiente, Repetir, Pausa y Detener permanecen visibles');

    // Siguiente cierra el primer elemento. Repetir descarta el intento,
    // pero mantiene el mismo elemento para el siguiente clip.
    await page.click('#bMarcar');
    await page.waitForFunction(() => document.querySelector('#listaLectura .lista-actual .valor')?.textContent === 'tortilla');
    await page.waitForTimeout(1100);
    await page.click('#bRepetirElemento');
    await page.waitForTimeout(250);
    ok(await page.locator('#listaLectura .lista-actual .valor').textContent() === 'tortilla',
      'Repetir mantiene seleccionado el mismo elemento');
    await page.waitForTimeout(1200);
    await page.click('#bDetener');
    await page.waitForSelector('#vFicha h2', { timeout: 10000 });

    const recording = await page.evaluate(async () => (await DB.todas('grabaciones'))[0]);
    ok(recording && recording.listaTrabajo && recording.listaTrabajo.id === lista.id,
      'la grabación conserva una copia de la lista utilizada');
    ok(recording && recording.clips.length === 3, 'se generaron tres clips a partir de las marcas');
    if (recording && recording.clips.length === 3) {
      const [primero, repetido, siguiente] = recording.clips;
      ok(primero.listaElementoId === recording.listaTrabajo.elementos[0].id,
        'primer clip vinculado al primer elemento');
      ok(repetido.descartado && repetido.listaElementoId === recording.listaTrabajo.elementos[1].id,
        'intento repetido queda descartado y conserva el segundo elemento');
      ok(!siguiente.descartado && siguiente.listaElementoId === repetido.listaElementoId,
        'el clip posterior a Repetir conserva el mismo elemento');
    }

    await page.fill('#titulo', 'Prueba de lista de trabajo');
    await page.waitForTimeout(500);

    // Modificar la lista original no debe modificar la copia guardada en la grabación.
    await page.click('nav.abajo [data-vista="vListas"]');
    await page.fill('#listaContenido', 'maíz\ntortilla revisada\nfrijol');
    await page.click('#bListaGuardar');
    const snapshot = await page.evaluate(async id => (await DB.leer('grabaciones', id)).listaTrabajo,
      recording.id);
    ok(snapshot.elementos[1].texto === 'tortilla', 'la grabación conserva la instantánea original de la lista');

    // ── Guion: un solo texto con saltos de línea ──
    await page.click('#bListaNueva');
    await page.fill('#listaNombre', 'Guion de prueba');
    await page.selectOption('#listaTipo', 'guion');
    await page.fill('#listaContenido', 'Presentación\nPregunta inicial\nCierre');
    await page.click('#bListaGuardar');
    const guion = await page.evaluate(async () =>
      (await DB.todas('listas')).find(x => x.nombre === 'Guion de prueba')
    );
    ok(guion && guion.tipo === 'guion' && guion.elementos.length === 0 &&
      guion.texto === 'Presentación\nPregunta inicial\nCierre',
      'el guion conserva el texto completo y sus saltos de línea');
    await page.click('nav.abajo [data-vista="vGrabar"]');
    ok(await page.locator('#listaLectura .lista-guion').textContent().then(x =>
      x.includes('Presentación') && x.includes('Pregunta inicial') && x.includes('Cierre')),
      'el guion se muestra completo debajo de los controles');

    // ── Exportar e importar el paquete en otro contexto ──
    await page.click('nav.abajo [data-vista="vAcervo"]');
    await page.click('#bTodas');
    await page.click('#bExportarSel');
    await page.waitForSelector('#eTam b');
    await page.click('#eOk');
    await page.waitForSelector('#eGuardar', { timeout: 30000 });
    const [zipDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#eGuardar')
    ]);
    const zipPath = path.join(OUT, zipDownload.suggestedFilename());
    await zipDownload.saveAs(zipPath);
    await page.click('#eFin');

    const otherContext = await browser.newContext({ acceptDownloads: true });
    const otherPage = await otherContext.newPage();
    const otherErrors = [];
    otherPage.on('pageerror', error => otherErrors.push(error.message));
    otherPage.on('dialog', dialog => dialog.accept());
    await otherPage.goto(BASE);
    await otherPage.click('nav.abajo [data-vista="vAcervo"]');
    await otherPage.setInputFiles('#archivoImportar', zipPath);
    await otherPage.waitForSelector('#iOk');
    await otherPage.click('#iOk');
    await otherPage.waitForTimeout(1200);

    const imported = await otherPage.evaluate(async () => {
      const recordings = await DB.todas('grabaciones');
      const lists = await DB.todas('listas');
      const r = recordings[0];
      return {
        titulo: r && r.ficha.titulo,
        snapshot: r && r.listaTrabajo,
        listas: lists.map(x => x.nombre)
      };
    });
    ok(imported.titulo === 'Prueba de lista de trabajo', 'la grabación se importa con su título');
    ok(imported.snapshot && imported.snapshot.nombre === 'Vocabulario de prueba',
      'el ZIP conserva la lista utilizada en la grabación');
    ok(imported.listas.includes('Vocabulario de prueba'), 'la lista asociada se incorpora al otro aparato');
    ok(!imported.listas.includes('Guion de prueba'), 'no se exportan listas personales sin relación con la grabación');
    ok(otherErrors.length === 0, 'sin errores al importar: ' + otherErrors.join(' | '));
    await otherContext.close();

    ok(errors.length === 0, 'sin errores en la prueba: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
})();
