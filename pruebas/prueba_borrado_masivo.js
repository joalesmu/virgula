const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  let cancelarPrimeraConfirmacion = true;
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('BORRAR');
    else if (dialog.type() === 'confirm' && cancelarPrimeraConfirmacion) {
      cancelarPrimeraConfirmacion = false;
      await dialog.dismiss();
    } else await dialog.accept();
  });

  await page.goto('http://localhost:8765/');
  await page.waitForTimeout(500);
  ok(await page.locator('#bBorrarSel').count() === 1, 'botón de borrado masivo disponible');
  ok(await page.locator('#bBorrarSel').isDisabled(), 'borrado deshabilitado sin selección');

  await page.evaluate(async () => {
    const ahora = Date.now();
    for (const [id, titulo] of [['prueba-borrar-a', 'Prueba borrar A'], ['prueba-borrar-b', 'Prueba borrar B']]) {
      const ficha = fichaVacia(ahora);
      ficha.titulo = titulo;
      ficha.consentimiento.estado = 'otorgado';
      const reg = {
        id, estado: 'lista', creada: ahora, modificada: ahora, duracion: 4,
        frames: 0, tecnica: { canales: 1, conArchivo: false, conConsulta: true, mime: 'audio/webm' },
        bytes: { archivo: 0, consulta: 4 }, clips: [], ficha
      };
      await DB.poner('grabaciones', reg);
      await DB.poner('trozos', { grabacion: id, tipo: 'consulta', n: 1, datos: new Blob(['audio-' + id], { type: 'audio/webm' }), frames: 0 });
      await DB.poner('adjuntos', { id: 'adj-' + id, grabacion: id, nombre: 'nota.txt', tipo: 'text/plain', datos: new Blob(['nota']), tam: 4 });
    }
  });
  await page.click('nav.abajo [data-vista="vAcervo"]');
  await page.waitForSelector('[data-sel="prueba-borrar-a"]');
  await page.check('[data-sel="prueba-borrar-a"]');
  await page.check('[data-sel="prueba-borrar-b"]');
  ok(await page.locator('#nBorrarSel').textContent() === '2', 'muestra la cantidad seleccionada');
  ok(!(await page.locator('#bBorrarSel').isDisabled()), 'borrado disponible con selección');

  // La primera confirmación se cancela: ningún dato debe desaparecer.
  await page.click('#bBorrarSel');
  ok(await page.evaluate(async () => (await DB.todas('grabaciones')).length === 2), 'cancelar conserva las grabaciones');

  // La segunda confirmación se acepta y el prompt de seguridad escribe BORRAR.
  await page.click('#bBorrarSel');
  await page.waitForFunction(async () => (await DB.todas('grabaciones')).length === 0);
  const restos = await page.evaluate(async () => ({
    trozos: (await DB.todas('trozos')).length,
    adjuntos: (await DB.todas('adjuntos')).length,
    seleccion: Acervo.sel.size
  }));
  ok(restos.trozos === 0, 'elimina también fragmentos de audio');
  ok(restos.adjuntos === 0, 'elimina también adjuntos');
  ok(restos.seleccion === 0, 'limpia la selección al terminar');
  ok(await page.locator('#bBorrarSel').isDisabled(), 'vuelve a deshabilitarse sin selección');
  ok(errors.length === 0, 'sin errores de JavaScript: ' + errors.join(' | '));
  await browser.close();
})();
