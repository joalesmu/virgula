const { chromium } = require('playwright');
const fs = require('fs'), OUT = require('os').tmpdir(), BASE = 'http://localhost:8765/';
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ permissions: ['microphone', 'geolocation'], geolocation: { latitude: 21.885312, longitude: -104.456789 }, acceptDownloads: true, viewport: { width: 400, height: 860 } });
  const p = await ctx.newPage(), err = [];
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept(d.type() === 'prompt' ? 'BORRAR' : undefined));
  await p.goto(BASE); await p.waitForTimeout(600);
  // ── Plantillas ──
  await p.click('nav.abajo [data-vista="vAjustes"]');
  ok(await p.locator('#plantillas .tarjeta').count() === 6, '6 plantillas de fábrica');
  await p.click('[data-pusar="naturaleza"]'); await p.waitForTimeout(300);
  ok((await p.textContent('#resumenAjustes')).includes('Sonidos de la naturaleza'), 'resumen muestra la plantilla activa');
  await p.click('nav.abajo [data-vista="vGrabar"]'); await p.click('#bGrabar'); await p.waitForTimeout(2500); await p.click('#bMarcar'); await p.waitForTimeout(1500); await p.click('#bDetener');
  await p.waitForSelector('#vFicha h2');
  ok(await p.locator('#cx_x_especie').count() === 1 && await p.locator('#fPart').count() === 0, 'ficha de naturaleza: campo especie, sin participantes');
  ok((await p.textContent('#fFaltan')).includes('Ubicación'), 'faltan: ubicación (obligatoria en naturaleza)');
  ok(await p.isChecked('input[name="consEstado"][value="no aplica"]'), 'consentimiento «no aplica» por defecto');
  await p.fill('#titulo', 'Coro de ranas'); await p.fill('#cx_x_especie', 'Hyla eximia'); await p.fill('#cx_x_individuos', '12'); await p.selectOption('#cx_x_comportamiento', 'Coro');
  await p.click('#bUbic'); await p.waitForTimeout(700);
  await p.waitForTimeout(700);
  ok((await p.textContent('#fFaltan')).includes('completa'), 'ficha completa tras ubicación: ' + await p.textContent('#fFaltan'));
  await p.fill('[data-clip="0"][data-k="etiqueta"]', 'ranas');
  await p.fill('#descripcion', 'Coro nocturno junto al arroyo');
  await p.waitForTimeout(700);
  // ── Editor: duplicar «Lengua», campo propio, fija ──
  await p.click('nav.abajo [data-vista="vAjustes"]'); await p.click('[data-pduplicar="lengua"]'); await p.waitForSelector('#plNombre');
  await p.fill('#plNombre', 'Vocabulario wixárika'); await p.click('#plAgregar');
  const n = await p.locator('[data-pc][data-k="etiqueta"]').count();
  await p.locator('[data-pc][data-k="etiqueta"]').nth(n - 1).fill('Campo semántico');
  await p.locator('[data-pc][data-k="tipo"]').last().selectOption('opcion'); await p.waitForTimeout(200);
  await p.locator('[data-pc][data-k="opciones"]').last().fill('Animales\nPlantas\nCuerpo');
  await p.locator('[data-pc][data-k="estandar"]').last().selectOption('dc:subject');
  await p.locator('[data-pc][data-k="obligatorio"]').last().check();
  await p.click('summary:has-text("Compartir con un equipo")'); await p.fill('#plEquipo', 'Equipo Wixárika'); await p.check('#plFija');
  await p.screenshot({ path: OUT + '/8_editor.png', fullPage: false });
  await p.click('#plGuardar'); await p.waitForTimeout(400);
  const pl = await p.evaluate(() => Plantillas.lista.find(x => x.nombre === 'Vocabulario wixárika'));
  ok(pl && pl.version === 2 && pl.fija && pl.campos.some(c => c.etiqueta === 'Campo semántico' && c.opciones.length === 3 && c.obligatorio), 'plantilla nueva guardada v2, fija, con campo propio');
  const [dlP] = await Promise.all([p.waitForEvent('download'), p.click(`[data-pexportar="${pl.id}"]`)]);
  const rutaPl = OUT + '/' + dlP.suggestedFilename(); await dlP.saveAs(rutaPl); ok(/plantilla_Vocabulario-wixarika_v2\.json/.test(rutaPl), 'plantilla exportada: ' + dlP.suggestedFilename());
  // grabar con la plantilla nueva
  await p.click(`[data-pusar="${pl.id}"]`); await p.click('nav.abajo [data-vista="vGrabar"]'); await p.click('#bGrabar'); await p.waitForTimeout(2000); await p.click('#bDetener'); await p.waitForSelector('#vFicha h2');
  const idCampo = pl.campos.find(c => c.etiqueta === 'Campo semántico').id;
  ok(await p.locator('#cx_' + idCampo).count() === 1, 'campo propio en la ficha');
  ok((await p.textContent('#fFaltan')).includes('Campo semántico'), 'campo propio obligatorio aparece en «Falta»');
  await p.selectOption('#cx_' + idCampo, 'Animales'); await p.fill('#titulo', 'Animales 1'); await p.fill('#lenguas', 'wixárika');
  await p.click('summary:has-text("Transcripción")'); await p.fill('#transTexto', 'tsikɨri kauxai'); await p.waitForTimeout(700);
  // ── Exportar con estándares ──
  await p.click('nav.abajo [data-vista="vAcervo"]'); await p.click('#bTodas'); await p.click('#bExportarSel'); await p.waitForSelector('#eTam b');
  await p.click('summary:has-text("Formatos")');
  ok(await p.locator('#eDwc').count() === 1 && await p.locator('#eElan').count() === 1, 'opciones Darwin Core y ELAN visibles');
  await p.click('#eOk'); await p.waitForSelector('#eGuardar', { timeout: 30000 });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#eGuardar')]);
  const zip = OUT + '/estandares.zip'; await dl.saveAs(zip);
  // ── Recordatorio ──
  await p.click('#eFin');
  await p.evaluate(async () => { const r = (await DB.todas('grabaciones'))[0]; r.respaldo = null; r.creada = Date.now() - 5 * 86400000; await DB.poner('grabaciones', r); });
  await p.reload(); await p.waitForTimeout(800);
  ok((await p.textContent('#avisoGlobal')).includes('sin respaldo'), 'recordatorio de respaldo a los 3 días');
  await p.click('#bRecordarManana'); await p.waitForTimeout(200); await p.reload(); await p.waitForTimeout(600);
  ok((await p.textContent('#avisoGlobal')).trim() === '', '«Mañana» pospone el recordatorio');
  // ── Reportar problema ──
  await p.click('nav.abajo [data-vista="vAjustes"]'); await p.click('#bReportar'); await p.fill('#repQue', 'prueba'); await p.click('#repOk'); await p.waitForSelector('#repSalida pre');
  const inf = await p.textContent('#repSalida pre'); ok(inf.includes('Vírgula 1.2') && !inf.includes('Coro de ranas'), 'informe técnico sin datos de fichas');
  ok((await p.getAttribute('#repSalida a.boton.prim', 'href')).startsWith('mailto:joalesmu@gmail.com'), 'informe por correo al proyecto');
  await p.click('#repNo');
  // ── Idioma: plantilla de traducción → probar ──
  const csvTxt = await p.evaluate(() => Idioma.plantillaCsv());
  ok(csvTxt.split('\n').length > 500 && csvTxt.includes('@codigo'), 'plantilla de traducción con ' + csvTxt.split('\n').length + ' renglones');
  const filas = csvTxt.replace(/^﻿/, '');
  const trad = { '@codigo': 'en', '@nombre': 'English', '@traductores': 'Prueba', '@formato_fechas': 'en-US', 'Grabar': 'Record', 'Acervo': 'Archive', 'Ajustes': 'Settings',
    '💾 Vírgula usa {usado}. Con estos ajustes caben unas {h} h {m} min más de grabación.': '💾 Vírgula uses {usado}. About {h} h {m} min of recording fit.',
    'Idioma de la interfaz': '<img src=x onerror="window.__xss=1">Language', 'Nivel de entrada': 'Input {mal}' };
  // Construimos el CSV de prueba con separador ; (como Excel en español)
  const lineas = ['texto_original;traduccion;donde_aparece;notas', ...Object.entries(trad).map(([k, v]) => `"${k.replace(/"/g, '""')}";"${v.replace(/"/g, '""')}";;`)];
  fs.writeFileSync(OUT + '/trad.csv', '﻿' + lineas.join('\r\n'));
  await p.click('summary:has-text("Traducir Vírgula")'); await p.setInputFiles('#archivoTraduccion', OUT + '/trad.csv'); await p.waitForTimeout(3500);
  ok((await p.textContent('nav.abajo')).includes('Record') && (await p.textContent('nav.abajo')).includes('Archive'), 'interfaz traducida tras probar');
  ok(await p.evaluate(() => document.documentElement.lang) === 'en', 'lang=en');
  await p.click('nav.abajo [data-vista="vAjustes"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !window.__xss && !document.querySelector('#panelIdioma img')), 'traducción con HTML no inyecta código');
  ok((await p.textContent('#espacio')).includes('uses'), 'texto con variables traducido');
  ok(await p.evaluate(() => !Idioma.textos['Nivel de entrada']), 'traducción con variables distintas se descarta');
  ok((await p.textContent('#idiomas')).includes('English 🧪'), 'idioma de prueba marcado 🧪');
  await p.click('#panelIdioma summary'); const [dlI] = await Promise.all([p.waitForEvent('download'), p.click('#bTEnviar')]);
  ok(/virgula-idioma-en-v1\.json/.test(dlI.suggestedFilename()) && (await p.getAttribute('#velo a.boton.prim', 'href')).includes('mailto:'), 'enviar traducción: archivo + correo');
  await p.click('#envCerrar');
  await p.check('input[name="aIdioma"][value="es"]'); await p.waitForTimeout(1500);
  ok((await p.textContent('nav.abajo')).includes('Grabar'), 'volver a español');
  await p.screenshot({ path: OUT + '/9_ajustes.png', fullPage: true });
  ok(err.length === 0, 'sin errores: ' + err.join(' | '));
  // ── Otro aparato: importar plantilla fija y paquete ──
  const c2 = await b.newContext({ acceptDownloads: true }), q = await c2.newPage(), err2 = [];
  q.on('pageerror', e => err2.push(e.message)); q.on('dialog', d => d.accept());
  await q.goto(BASE); await q.click('nav.abajo [data-vista="vAjustes"]');
  await q.setInputFiles('#archivoPlantilla', rutaPl); await q.waitForTimeout(500);
  ok(await q.locator(`[data-peditar="${pl.id}"]`).textContent().then(s => s.includes('Ver')), 'plantilla fija importada: solo «Ver»');
  await q.click(`[data-peditar="${pl.id}"]`); ok(await q.locator('#plGuardar').count() === 0 && await q.isDisabled('#plNombre'), 'editor en solo lectura'); await q.click('#plCerrar');
  await q.click('nav.abajo [data-vista="vAcervo"]'); await q.setInputFiles('#archivoImportar', zip); await q.waitForSelector('#iOk'); await q.click('#iOk'); await q.waitForTimeout(1500);
  ok(await q.locator('#lista .tarjeta').count() === 2, 'paquete importado (2 grabaciones)');
  ok(await q.evaluate(() => Plantillas.lista.some(p => p.id === 'naturaleza')), 'plantillas del paquete disponibles');
  ok(err2.length === 0, 'sin errores en el otro aparato: ' + err2.join(' | '));
  await b.close();
})();
