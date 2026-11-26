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
    const informe = [`Vírgula ${VERSION} · ${new Date().toISOString()}`, `Compilación interna: ${BUILD_INTERNO}`, `${t('Qué pasó')}: ${$('repQue').value.trim() || '—'}`, '',
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

/* ── Compartir la aplicación ── */
async function compartirApp() {
  const datos = {
    title: 'Vírgula · memoria sonora viva',
    text: 'Una herramienta para grabar, documentar y preservar la memoria sonora.',
    url: APPWEB
  };

  try {
    if (navigator.share) {
      await navigator.share(datos);
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(APPWEB);
      avisar(t('🔗 Enlace copiado. Ya puedes compartirlo.'));
    } else {
      window.prompt(t('Copia el enlace de Vírgula:'), APPWEB);
    }
  } catch (e) {
    window.prompt(t('Copia el enlace de Vírgula:'), APPWEB);
  }
}

$('bCompartir').onclick = compartirApp;

  
/* ── Instalar como app ── */
let pedidoInstalar = null;
if (ES_IOS && !INSTALADA) $('bInstalar').classList.remove('oculto');   // en iPhone no hay aviso automático: se explica cómo
function instruccionesIos() {
  Ventana.abrir(`<h2>${tH('⬇️ Instalar en iPhone o iPad')}</h2>
    <p>${tH('1. Abre esta página en **Safari**.')}</p><p>${tH('2. Toca **Compartir** (el cuadro con la flecha hacia arriba).')}</p>
    <p>${tH('3. Elige **Agregar a pantalla de inicio** y luego **Agregar**.')}</p>
    <div class="banda info">${tH('Instálala antes de grabar: en iPhone, Safari borra los datos de las páginas que no se usan en 7 días, pero no los de las apps agregadas a la pantalla de inicio.')}</div>
    <div class="banda aviso">${tH('En iPhone, la app instalada y Safari guardan por separado: lo grabado en Safari no aparece en la app. Si ya grabaste en Safari, exporta esas grabaciones desde Safari (📦 Exportar) e impórtalas en la app (📥 Importar paquete).')}</div>
    <div class="fila"><button id="iosCerrar">${tH('Entendido')}</button></div>`);
  $('iosCerrar').onclick = () => Ventana.cerrar();
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e; $('bInstalar').classList.remove('oculto'); });
$('bInstalar').onclick = async () => { if (ES_IOS && !pedidoInstalar) return instruccionesIos(); if (!pedidoInstalar) return; pedidoInstalar.prompt(); await pedidoInstalar.userChoice.catch(() => {}); pedidoInstalar = null; $('bInstalar').classList.add('oculto'); };
window.addEventListener('appinstalled', () => { $('bInstalar').classList.add('oculto'); avisar(t('✅ Vírgula quedó instalada.')); });

/* ── Actualizaciones: comprobación automática y manual, sin interrumpir grabaciones ── */
let registroSW = null;
let trabajadorPendiente = null;
let recargaActualizacionPendiente = false;
let controladorEstablecido = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
let ultimaComprobacionSW = 0;

function estadoActualizacion(mensaje, tipo = '') {
  const el = $('estadoActualizaciones');
  if (el) { el.textContent = t(mensaje); el.className = 'nota' + (tipo ? ' ' + tipo : ''); }
}

function mostrarActualizacionDisponible(worker) {
  trabajadorPendiente = worker || (registroSW && registroSW.waiting) || null;
  if (!trabajadorPendiente) return;
  const aviso = $('avisoActualizacion');
  aviso.classList.remove('oculto', 'aviso'); aviso.classList.add('ok');
  aviso.innerHTML = `${tH('✨ Hay una versión nueva de Vírgula disponible.')} <div class="fila fija"><button class="chico prim" id="bActualizar">${tH('Actualizar ahora')}</button></div>`;
  $('bActualizar').onclick = () => {
    if (G) return avisar(t('Termina la grabación antes de actualizar. La nueva versión permanecerá pendiente.'));
    if (!trabajadorPendiente) return avisar(t('La actualización ya no está pendiente. Comprueba de nuevo.'));
    trabajadorPendiente.postMessage('saltar');
    estadoActualizacion('Preparando la actualización…');
  };
  estadoActualizacion('Hay una actualización lista para instalar.', 'ok');
}

async function comprobarActualizaciones(manual = false) {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
    estadoActualizacion('Este navegador no permite actualizar Vírgula como aplicación instalada.', 'aviso');
    return;
  }
  if (!navigator.onLine) {
    estadoActualizacion('No hay conexión. No se pudo comprobar si existe una versión nueva.', 'aviso');
    if (manual) avisar(t('Conéctate a internet para comprobar actualizaciones.'));
    return;
  }
  try {
    if (!registroSW) registroSW = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    if (registroSW.waiting) { mostrarActualizacionDisponible(registroSW.waiting); return; }
    estadoActualizacion('Buscando actualizaciones…');
    await registroSW.update();
    ultimaComprobacionSW = Date.now();
    if (registroSW.waiting) {
      mostrarActualizacionDisponible(registroSW.waiting);
    } else if (registroSW.installing) {
      const instalando = registroSW.installing;
      if (instalando.state === 'installed' && navigator.serviceWorker.controller) { mostrarActualizacionDisponible(registroSW.waiting || instalando); return; }
      estadoActualizacion('Se encontró una versión nueva. Se está descargando…');
      instalando.addEventListener('statechange', () => {
        if (instalando.state === 'installed' && navigator.serviceWorker.controller) mostrarActualizacionDisponible(registroSW.waiting || instalando);
        if (instalando.state === 'redundant') estadoActualizacion('No se pudo instalar la actualización. Revisa la conexión e inténtalo de nuevo.', 'aviso');
      });
    } else {
      estadoActualizacion('Vírgula está actualizada.', 'ok');
      if (manual) avisar(t('✅ Vírgula está actualizada.'));
    }
  } catch (e) {
    Bitacora.poner('comprobar actualización', e && e.message ? e.message : String(e));
    estadoActualizacion('No se pudo comprobar la actualización. Revisa la conexión e inténtalo de nuevo.', 'aviso');
    if (manual) avisar(t('No se pudo comprobar la actualización. Revisa la conexión.'));
  }
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controladorEstablecido) { controladorEstablecido = true; return; }
    if (G || Nav.actual === 'vFicha') {
      recargaActualizacionPendiente = true;
      estadoActualizacion('La versión nueva está activa. Recarga Vírgula cuando termines de trabajar.', 'ok');
      $('avisoActualizacion').classList.remove('oculto');
      $('avisoActualizacion').innerHTML = `${tH('La actualización está lista.')} <div class="fila fija"><button class="chico prim" id="bRecargarActualizada">${tH('Recargar ahora')}</button></div>`;
      $('bRecargarActualizada').onclick = () => {
        if (G) return avisar(t('Termina la grabación antes de recargar.'));
        recargaActualizacionPendiente = false; location.reload();
      };
      return;
    }
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => {
    registroSW = r;
    if (r.waiting) mostrarActualizacionDisponible(r.waiting);
    r.addEventListener('updatefound', () => {
      const n = r.installing; if (!n) return;
      n.addEventListener('statechange', () => {
        if (n.state === 'installed' && navigator.serviceWorker.controller) mostrarActualizacionDisponible(r.waiting || n);
        if (n.state === 'redundant') Bitacora.poner('service worker', 'La nueva versión no pudo instalarse.');
      });
    });
    comprobarActualizaciones(false);
  }).catch(e => {
    Bitacora.poner('registro service worker', e && e.message ? e.message : String(e));
    estadoActualizacion('No se pudo registrar el sistema de actualizaciones.', 'aviso');
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - ultimaComprobacionSW > 5 * 60 * 1000) comprobarActualizaciones(false);
  });
}

(async () => {
  $('version').textContent = VERSION;
  try { await DB.abrir(); } catch (e) { $('avisoRecuperar').classList.remove('oculto'); $('avisoRecuperar').textContent = t('⚠️ Este navegador no deja guardar datos (¿ventana privada?). Vírgula necesita guardar en el aparato.'); return; }
  await Ajustes.cargar();
  await Idioma.cargar();
  await Plantillas.cargar();
  await ListaTrabajo.cargar();
  Ajustes.pintar();
  if (ES_IOS) $('avisoIos').classList.remove('oculto');
  $('bGrabar').innerHTML = '⏺<br>' + tH('Grabar'); $('bPausa').textContent = t('⏸ Pausa'); $('nivelNota').textContent = t('Nivel de entrada');
  let resultadoTemporal = {
    recuperados: 0,
    pendientes: 0,
    grabacionesPendientes: []
  };

  let recuperacionComprobada = true;

  try {
    resultadoTemporal = await RespaldoTemporal.recuperar();
  } catch (e) {
    recuperacionComprobada = false;
    Bitacora.poner(
      'recuperación OPFS',
      e && e.message ? e.message : String(e)
    );
  }

  await revisarPendientes(
    resultadoTemporal.grabacionesPendientes || [],
    recuperacionComprobada
  );

  Espacio.actualizar();
  Recordatorio.revisar();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Recordatorio.revisar(); });
  if (new URLSearchParams(location.search).get('v') === 'acervo') Nav.ir('vAcervo');
})();

