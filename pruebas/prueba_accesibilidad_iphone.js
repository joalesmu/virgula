const { chromium } = require('playwright');
const OUT = require('os').tmpdir(), BASE = 'http://localhost:8765/';
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  // Accesibilidad
  const ctx = await b.newContext({ permissions: ['microphone'], viewport: { width: 400, height: 860 } });
  const p = await ctx.newPage(), err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(BASE); await p.click('nav.abajo [data-vista="vAjustes"]');
  const fs0 = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  await p.check('input[name="aEscala"][value="1.3"]'); await p.check('input[name="aTema"][value="claro"]'); await p.waitForTimeout(300);
  const fs1 = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  ok(Math.abs(fs1 / fs0 - 1.3) < 0.01, `letra ×1.3 (${fs0} → ${fs1} px)`);
  ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(246, 244, 238)', 'tema claro aplicado');
  await p.reload(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.documentElement.dataset.tema) === 'claro', 'tema se conserva al volver a abrir');
  await p.screenshot({ path: OUT + '/12_claro_grande.png' });
  await p.click('nav.abajo [data-vista="vAjustes"]'); await p.check('input[name="aTema"][value="contraste"]'); await p.check('#aMovimiento'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(0, 0, 0)', 'alto contraste');
  await p.click('nav.abajo [data-vista="vGrabar"]'); await p.click('#bGrabar'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('bGrabar')).animationName) === 'none', 'sin animación con movimiento reducido');
  await p.click('#bDetener'); await p.waitForSelector('#vFicha h2');
  await p.screenshot({ path: OUT + '/13_contraste_ficha.png' });
  ok(err.length === 0, 'sin errores: ' + err.join(' | '));
  // iPhone simulado (motor de Chrome con identidad de iPhone: prueba la interfaz, no el audio de Safari)
  const ios = await b.newContext({ permissions: ['microphone'], viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true });
  const q = await ios.newPage(), e2 = []; q.on('pageerror', e => e2.push(e.message));
  await q.goto(BASE); await q.waitForTimeout(500);
  ok(await q.isVisible('#bInstalar') && await q.isVisible('#avisoIos'), 'iPhone: botón Instalar y aviso de pantalla');
  await q.click('#bInstalar'); ok((await q.textContent('#velo')).includes('Agregar a pantalla de inicio'), 'iPhone: instrucciones para instalar'); await q.click('#iosCerrar');
  await q.click('#bGrabar'); await q.waitForTimeout(1500); await q.click('#bDetener'); await q.waitForSelector('#vFicha h2');
  const r = await q.evaluate(async () => (await DB.todas('grabaciones'))[0].tecnica);
  ok(r.conArchivo && r.sr > 0, 'iPhone simulado: graba (' + r.sr + ' Hz, ' + (r.mime || 'sin consulta') + ')');
  await q.screenshot({ path: OUT + '/14_iphone.png' });
  ok(e2.length === 0, 'sin errores (iPhone simulado): ' + e2.join(' | '));
  await b.close();
})();
