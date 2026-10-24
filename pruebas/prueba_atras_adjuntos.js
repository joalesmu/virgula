// Vírgula 1.2: botón «atrás» del teléfono y adjuntos dentro de la app.
// Uso: python3 -m http.server 8765 &   y luego   node pruebas/prueba_atras_adjuntos.js
const { chromium } = require('playwright');
const OUT = require('os').tmpdir(), BASE = 'http://localhost:8765/', fs = require('fs');
let F = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) F++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const c = await b.newContext({ permissions: ['microphone'], viewport: { width: 400, height: 860 } });
  const p = await c.newPage(), err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + 'manifest.webmanifest'); await p.goto(BASE); await p.waitForTimeout(600);
  // Grabando: «atrás» no sale de la app
  await p.click('#bGrabar'); await p.waitForTimeout(1500);
  await p.goBack(); await p.waitForTimeout(500);
  ok(p.url().startsWith(BASE) && !p.url().includes('manifest') && await p.evaluate(() => !!G), 'grabando: atrás no sale de la app y sigue grabando');
  await p.click('#bDetener'); await p.waitForSelector('#vFicha h2');
  // Ficha → atrás → Acervo
  await p.goBack(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => Nav.actual) === 'vAcervo' && !p.url().includes('manifest'), 'desde la ficha, atrás vuelve al Acervo');
  // Ventana → atrás la cierra
  await p.click('[data-abrir]'); await p.waitForSelector('#vFicha h2');
  fs.writeFileSync(OUT + '/foto.svg', "<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='teal'/></svg>");
  await p.setInputFiles('#fileAdj', { name: 'foto.svg', mimeType: 'image/svg+xml', buffer: fs.readFileSync(OUT + '/foto.svg') }); await p.waitForTimeout(500);
  await p.click('[data-adj]'); await p.waitForSelector('#velo img');
  ok(await p.isVisible('#velo img') && await p.isVisible('#adjGuardar'), 'foto adjunta se ve dentro de Vírgula');
  await p.goBack(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !$('velo') && Nav.actual === 'vFicha'), 'atrás cierra la ventana y deja la ficha');
  await p.click('#adjCerrar').catch(() => {});
  await p.click('#fVolver'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !(history.state && history.state.capa)), 'volver con el botón no deja pasos de más');
  await p.goBack(); await p.waitForTimeout(400);
  ok(p.url().includes('manifest'), 'en el Acervo sin nada abierto, atrás sale como siempre');
  ok(err.length === 0, 'sin errores: ' + err.join(' | '));
  await b.close(); console.log(F ? 'FALLAS: ' + F : 'TODO OK'); process.exitCode = F ? 1 : 0;
})();
