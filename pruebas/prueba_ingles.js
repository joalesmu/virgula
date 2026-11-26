const { chromium } = require('playwright');
const OUT = require('os').tmpdir(), BASE = 'http://localhost:8765/';
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ permissions: ['microphone'], viewport: { width: 400, height: 860 } });
  const p = await ctx.newPage(), err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(BASE); await p.click('nav.abajo [data-vista="vAjustes"]');
  await p.click('#bIdiomaRed'); await p.waitForSelector('[data-ibajar="en.json"]'); await p.click('[data-ibajar="en.json"]'); await p.waitForTimeout(500);
  const avancePublicado = await p.evaluate(async () => { const r = await fetch('idiomas/lista.json', { cache: 'no-store' }); const j = await r.json(); const en = j.idiomas.find(x => x.codigo === 'en'); return en ? en.avance : null; });
  ok((await p.textContent('#idiomas')).includes('English') && avancePublicado != null && (await p.textContent('#idiomas')).includes(`${avancePublicado} %`), `inglés publicado con avance declarado (${avancePublicado} %)`);
  await p.check('input[name="aIdioma"][value="en"]'); await p.waitForTimeout(1500);
  const cobertura = await p.evaluate(() => {
    const claves = TEXTOS_FUENTE.map(x => x[0]);
    const faltantes = claves.filter(k => !Idioma.textos[k]);
    const variables = claves.filter(k => {
      const a = (k.match(/\{(\w+)\}/g) || []).sort().join('|');
      const b = ((Idioma.textos[k] || '').match(/\{(\w+)\}/g) || []).sort().join('|');
      return a !== b;
    });
    return { total: claves.length, faltantes: faltantes.length, variables: variables.length, avance: Idioma.avance(Idioma.paquete) };
  });
  ok(cobertura.faltantes === 0 && cobertura.variables === 0 && cobertura.avance === 100,
    `cobertura inglesa completa: ${cobertura.total} textos, ${cobertura.faltantes} faltantes, ${cobertura.variables} variables incorrectas`);
  await p.screenshot({ path: OUT + '/10_en_grabar.png' });
  ok((await p.textContent('#bGrabar')).includes('Record') && (await p.textContent('#vGrabar')).includes('Input level'), 'pantalla de grabar en inglés');
  ok((await p.textContent('nav.abajo')).includes('Lists'), 'pestaña Listas traducida');
  await p.click('nav.abajo [data-vista="vListas"]');
  ok((await p.textContent('#vListas h2')).includes('Work lists'), 'título de Listas traducido');
  ok((await p.textContent('#bListaNueva')).includes('New list'), 'acción para crear listas traducida');
  await p.click('#bListaNueva');
  ok((await p.locator('label[for="listaNombre"]').textContent()).includes('List name'), 'campo de nombre traducido');
  ok(await p.getAttribute('#listaNombre', 'placeholder') === 'E.g. Food vocabulary', 'placeholder de lista traducido');
  ok((await p.locator('#listaTipo option').allTextContents()).join('|').includes('Items (one entry per line)') &&
    (await p.locator('#listaTipo option').allTextContents()).join('|').includes('Script (full text)'), 'tipos de lista traducidos');
  ok((await p.getAttribute('#listaContenido', 'placeholder')).includes('One item per line.'), 'placeholder de contenido traducido');
  ok((await p.textContent('#bMarcar')).includes('Next') && (await p.textContent('#bRepetirElemento')).includes('Repeat'), 'acciones Siguiente y Repetir traducidas');
  await p.click('nav.abajo [data-vista="vGrabar"]');
  await p.click('#bGrabar'); await p.waitForTimeout(1500); await p.click('#bDetener'); await p.waitForSelector('#vFicha h2');
  ok((await p.textContent('#vFicha')).includes('Consent') && (await p.textContent('#vFicha h2')).startsWith('Recording'), 'ficha en inglés');
  await p.screenshot({ path: OUT + '/11_en_ficha.png' });
  await p.click('nav.abajo [data-vista="vAjustes"]');
  ok((await p.textContent('#creditosIdioma')).includes('English'), 'créditos de la traducción en «Acerca de»');
  ok(err.length === 0, 'sin errores: ' + err.join(' | '));
  await b.close();
})();
