/* ═════════════════ ARRANQUE ═════════════════ */
$('vAjustes').addEventListener('change', e => { if (e.target.closest('input,select')) Ajustes.leerFormulario(); });
$('vAjustes').addEventListener('input', e => { if (e.target.type === 'text') { clearTimeout(Ajustes._t); Ajustes._t = setTimeout(() => Ajustes.leerFormulario(), 400); } });

$('bBuscarMic').onclick = async () => {
  try {
    // Los nombres de los micrófonos solo aparecen después de dar permiso
    const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop());
    const mics = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
    $('aMic').innerHTML = '<option value="">Predeterminado del aparato</option>' + mics.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || 'Micrófono ' + (i + 1))}</option>`).join('');
    $('aMic').value = mics.some(d => d.deviceId === Ajustes.v.mic) ? Ajustes.v.mic : '';
    Ajustes.leerFormulario(); avisar(`🎙️ ${mics.length} micrófono(s) encontrado(s).`);
  } catch (e) { avisar('No se pudo ver los micrófonos: ' + e.message, 5000); }
};

/* Instalar como app */
let pedidoInstalar = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e; $('bInstalar').classList.remove('oculto'); });
$('bInstalar').onclick = async () => { if (!pedidoInstalar) return; pedidoInstalar.prompt(); await pedidoInstalar.userChoice.catch(() => {}); pedidoInstalar = null; $('bInstalar').classList.add('oculto'); };
window.addEventListener('appinstalled', () => { $('bInstalar').classList.add('oculto'); avisar('✅ Vírgula quedó instalada.'); });

/* Funciona sin conexión; avisa cuando hay versión nueva (nunca recarga en medio de una grabación) */
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
          b.innerHTML = '✨ Hay una versión nueva de Vírgula. <div class="fila fija"><button class="chico prim" id="bActualizar">Actualizar ahora</button></div>';
          $('bActualizar').onclick = () => { if (G) return avisar('Termina la grabación antes de actualizar.'); n.postMessage('saltar'); };
        }
      });
    });
  }).catch(() => {});
}

(async () => {
  $('version').textContent = VERSION;
  try { await DB.abrir(); } catch (e) { $('avisoRecuperar').classList.remove('oculto'); $('avisoRecuperar').textContent = '⚠️ Este navegador no deja guardar datos (¿ventana privada?). Vírgula necesita guardar en el aparato.'; return; }
  await Ajustes.cargar();
  await revisarPendientes();
  Espacio.actualizar();
  if (new URLSearchParams(location.search).get('v') === 'acervo') Nav.ir('vAcervo');
})();
