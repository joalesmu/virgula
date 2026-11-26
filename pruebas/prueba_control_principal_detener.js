// Comprueba que el botón principal también detiene la grabación y que el botón
// flotante independiente conserva su función. Ejecutar con el servidor local en :8765.
const { chromium } = require('playwright');
const BASE = 'http://localhost:8765/';
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch({ args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required'
  ] });
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 400, height: 860 }
  });
  const page = await context.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

  try {
    await page.goto(BASE);
    await page.waitForTimeout(700);
    ok(await page.locator('#bGrabar').getAttribute('aria-label') === 'Grabar', 'el control principal inicia con la acción Grabar');

    // Ruta 1: detener desde el botón principal.
    await page.click('#bGrabar');
    await page.waitForFunction(() => G && G.interfazActiva === true, null, { timeout: 12000 });
    ok((await page.locator('#bGrabar').getAttribute('aria-label')).includes('Detener'), 'el control principal cambia a Detener');
    ok(await page.locator('#bDetener').isVisible(), 'se conserva el botón flotante Detener');
    ok(await page.locator('#bDetener').isEnabled(), 'el botón flotante sigue disponible');
    await page.waitForTimeout(1300);
    await page.click('#bGrabar');
    await page.waitForSelector('#vFicha h2', { timeout: 15000 });
    const primera = await page.evaluate(async () => (await DB.todas('grabaciones')).at(-1));
    ok(primera && primera.estado === 'lista' && primera.duracion > 0, 'el botón principal cierra y guarda la grabación');
    ok(await page.locator('#bGrabar').getAttribute('aria-label') === 'Grabar', 'el control principal vuelve a Grabar después de guardar');
    ok(await page.locator('#bGrabar').isEnabled(), 'el control principal queda habilitado para una nueva grabación');

    // Ruta 2: el botón independiente sigue ejecutando la misma rutina.
    await page.click('nav.abajo [data-vista="vGrabar"]');
    await page.click('#bGrabar');
    await page.waitForFunction(() => G && G.interfazActiva === true, null, { timeout: 12000 });
    await page.waitForTimeout(1000);
    await page.click('#bDetener');
    await page.waitForSelector('#vFicha h2', { timeout: 15000 });
    const segunda = await page.evaluate(async () => (await DB.todas('grabaciones')).at(-1));
    ok(segunda && segunda.estado === 'lista' && segunda.duracion > 0, 'el botón flotante también cierra y guarda');
    ok(await page.locator('#bGrabar').getAttribute('aria-label') === 'Grabar', 'ambas rutas restauran el botón principal');
    ok(errores.length === 0, 'sin errores de JavaScript: ' + errores.join(' | '));
  } finally {
    await browser.close();
  }
})();
