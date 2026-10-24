/* ═════════════════ ARRANQUE, AJUSTES, IDIOMA Y AYUDA ═════════════════ */
$('vAjustes').addEventListener('change', e => { if (e.target.closest('#panelIdioma')) return; if (e.target.closest('input[name^="a"],select[id^="a"],input[id^="a"]')) Ajustes.leerFormulario(); });
$('vAjustes').addEventListener('input', e => { if (e.target.type === 'text' && e.target.id.startsWith('a')) { clearTimeout(Ajustes._t); Ajustes._t = setTimeout(() => Ajustes.leerFormulario(), 400); } });

$('bBuscarMic').onclick = async () => {
  try {
    // Los nombres de los micrófonos solo aparecen después de dar permiso
    const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(x => x.stop());
    const mics = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
    $('aMic').innerHTML = `<option value="">${tH('Predeterminado del aparato')}</option>` + mics.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || t('Micrófono {n}', { n: i + 1 }))}</option>`).join('');
    $('aMic').value = mics.some(d => d.deviceId === Ajustes.v.mic) ? Ajustes.v.mic : '';
    Ajustes.leerFormulario(); avisar(t('🎙️ {n} micrófono(s) encontrado(s).', { n: mics.length }));
  } catch (e) { avisar(t('No se pudo ver los micrófonos: {error}', { error: e.message }), 5000); }
};

/* ── Idioma ── */
$('bIdiomaCabeza').onclick = () => { Nav.ir('vAjustes'); $('panelIdioma').scrollIntoView({ behavior: 'smooth' }); };
$('idiomas').addEventListener('change', e => { if (e.target.name === 'aIdioma') Idioma.elegir(e.target.value); });
$('idiomas').addEventListener('click', e => { const b = e.target.closest('[data-iquitar],[data-ibajar]'); if (!b) return; if (b.dataset.iquitar) Idioma.quitar(b.dataset.iquitar); else Idioma.bajar(b.dataset.ibajar); });
$('bIdiomaRed').onclick = () => Idioma.buscarPublicados();
$('bIdiomaInstalar').onclick = () => $('archivoIdioma').click();
$('archivoIdioma').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) Idioma.instalarArchivo(f, false); };
$('bTPlantilla').onclick = () => Idioma.bajarPlantilla();
$('bTProbar').onclick = () => $('archivoTraduccion').click();
$('archivoTraduccion').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) Idioma.instalarArchivo(f, true); };
$('bTEnviar').onclick = () => Idioma.enviar();
function pintarBaseTraduccion() {
  $('tBase').innerHTML = `<option value="">${tH('Plantilla vacía (una lengua nueva)')}</option>` + Idioma.instalados.map(p => `<option value="${esc(p.codigo)}" ${p.codigo === Idioma.codigo ? 'selected' : ''}>${tH('Mejorar: {nombre}', { nombre: p.nombre })} (${Idioma.avance(p)} %)</option>`).join('');
  const p = Idioma.paquete;
  $('creditosIdioma').innerHTML = p ? tH('Interfaz en {nombre}: tradujo {quien}{avala}.', { nombre: p.nombre, quien: p.traductores || '—', avala: p.avala ? ' · ' + t('avala {quien}', { quien: p.avala }) : '' }) : '';
}

/* ── Reportar un problema ── */
$('bReportar').onclick = async () => {
  Ventana.abrir(`<h2>${tH('📨 Reportar un problema')}</h2>
    <label for="repQue">${tH('¿Qué pasó? ¿Qué estabas haciendo?')}</label><textarea id="repQue" maxlength="3000"></textarea>
    <p class="nota">${tH('Se agregan datos técnicos: versión, aparato, navegador, espacio, ajustes de grabación y errores recientes. No se incluyen audios, fichas ni nombres.')}</p>
    <div class="fila"><button class="prim" id="repOk">${tH('Preparar informe')}</button><button id="repNo">${tH('Cancelar')}</button></div><div id="repSalida"></div>`);
  $('repNo').onclick = () => Ventana.cerrar();
  $('repOk').onclick = async () => {
    const e = await Espacio.datos().catch(() => null), regs = await DB.todas('grabaciones').catch(() => []), ult = regs.sort((a, b) => b.creada - a.creada)[0], v = Ajustes.v;
    const informe = [`Vírgula ${VERSION} · ${new Date().toISOString()}`, `${t('Qué pasó')}: ${$('repQue').value.trim() || '—'}`, '',
      `UA: ${navigator.userAgent}`, `${t('Instalada')}: ${matchMedia('(display-mode: standalone)').matches ? t('sí') : t('no')} · ${t('Idioma')}: ${Idioma.codigo}`,
      `${t('Espacio')}: ${e ? mb(e.usado) + ' / ' + mb(e.cuota) : '—'} · ${t('Grabaciones')}: ${regs.length}`,
      `${t('Ajustes')}: calidad=${v.calidad} canales=${v.canales} volAuto=${v.volAuto} ruido=${v.ruido} eco=${v.eco} mic=${v.mic ? 'externo' : 'predeterminado'}`,
      `Recorder: ${formatoConsulta() || '—'} · AudioEncoder: ${!!window.AudioEncoder} · WakeLock: ${'wakeLock' in navigator} · Share: ${!!navigator.canShare}`,
      ult ? `${t('Última grabación')}: ${reloj(ult.duracion)} · ${ult.tecnica.sr} Hz · huecos ${(ult.huecos || 0).toFixed(1)} s · ${t('tramos sin audio')} ${(ult.silencios || []).length} · ${JSON.stringify(ult.tecnica.ajustesReales)}` : '',
      ult ? `${t('Eventos')}:\n` + (ult.eventos || []).slice(-25).map(x => `  ${relojFino(x.t)} ${x.tipo}`).join('\n') : '',
      `${t('Errores recientes')}:\n` + (Bitacora.l.join('\n') || '  —')].filter(Boolean).join('\n');
    const asunto = t('Problema en Vírgula {v}', { v: VERSION });
    const archivo = new File([informe], `virgula_informe_${sello(new Date())}.txt`, { type: 'text/plain' });
    $('repSalida').innerHTML = `<pre>${esc(informe)}</pre>
      <div class="fila"><a class="boton prim" href="mailto:${CORREO_PROYECTO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(informe.slice(0, 1800))}">${tH('✉️ Por correo')}</a>
        <a class="boton" target="_blank" rel="noopener" href="${REPO}/issues/new?title=${encodeURIComponent(asunto)}&body=${encodeURIComponent('```\n' + informe.slice(0, 5000) + '\n```')}">${tH('🐙 En GitHub')}</a>
        <button id="repGuardar">${tH('⬇️ Guardar informe')}</button></div>
      <p class="nota">${tH('Revisa el texto antes de enviarlo. Si es largo, el correo lleva solo el principio: adjunta el informe guardado.')}</p>`;
    $('repGuardar').onclick = () => descargarArchivos([archivo]);
    $('repSalida').scrollIntoView({ behavior: 'smooth' });
  };
};

/* ── Instalar como app ── */
let pedidoInstalar = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e; $('bInstalar').classList.remove('oculto'); });
$('bInstalar').onclick = async () => { if (!pedidoInstalar) return; pedidoInstalar.prompt(); await pedidoInstalar.userChoice.catch(() => {}); pedidoInstalar = null; $('bInstalar').classList.add('oculto'); };
window.addEventListener('appinstalled', () => { $('bInstalar').classList.add('oculto'); avisar(t('✅ Vírgula quedó instalada.')); });

/* ── Sin conexión; avisa cuando hay versión nueva (nunca recarga en medio de una grabación) ── */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const habia = !!navigator.serviceWorker.controller;   // en la primera visita no se recarga
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (habia && !G) location.reload(); });
  navigator.serviceWorker.register('sw.js').then(r => {
    r.addEventListener('updatefound', () => {
      const n = r.installing; if (!n) return;
      n.addEventListener('statechange', () => {
        if (n.state === 'installed' && navigator.serviceWorker.controller) {
          const b = $('avisoRecuperar');
          if (!b.classList.contains('oculto')) return;
          b.classList.remove('oculto', 'aviso'); b.classList.add('ok');
          b.innerHTML = `${tH('✨ Hay una versión nueva de Vírgula.')} <div class="fila fija"><button class="chico prim" id="bActualizar">${tH('Actualizar ahora')}</button></div>`;
          $('bActualizar').onclick = () => { if (G) return avisar(t('Termina la grabación antes de actualizar.')); n.postMessage('saltar'); };
        }
      });
    });
  }).catch(() => {});
}

(async () => {
  $('version').textContent = VERSION;
  try { await DB.abrir(); } catch (e) { $('avisoRecuperar').classList.remove('oculto'); $('avisoRecuperar').textContent = t('⚠️ Este navegador no deja guardar datos (¿ventana privada?). Vírgula necesita guardar en el aparato.'); return; }
  await Ajustes.cargar();
  await Idioma.cargar();
  await Plantillas.cargar();
  Ajustes.pintar();
  $('bGrabar').innerHTML = '⏺<br>' + tH('Grabar'); $('bPausa').textContent = t('⏸ Pausa'); $('nivelNota').textContent = t('Nivel de entrada');
  await revisarPendientes();
  Espacio.actualizar(); Recordatorio.revisar();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Recordatorio.revisar(); });
  if (new URLSearchParams(location.search).get('v') === 'acervo') Nav.ir('vAcervo');
})();
