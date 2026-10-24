/* ═════════════════ GRABADORA ═════════════════
   Dos caminos a la vez desde el mismo micrófono:
   · archivo: PCM de 16 bits tal como llega (WAV), guardado por partes cada 2 s;
   · consulta: comprimido (Opus/AAC) con volumen automático propio y limitador, SOLO en este camino.
   Así el archivo conserva el sonido real y la consulta se escucha bien. */
let G = null;   // la grabación en curso

const CODIGO_CAPTURA = `
class Captura extends AudioWorkletProcessor {
  constructor(o) { super(); this.ch = o.processorOptions.canales; this.tam = Math.round(sampleRate / 10); this.buf = new Int16Array(this.tam * this.ch); this.i = 0;
    this.port.onmessage = e => { if (e.data === 'vaciar') { this.enviar(); this.port.postMessage({ vaciado: true }); } }; }
  enviar() { if (!this.i) return; const out = this.buf.slice(0, this.i * this.ch); this.port.postMessage({ buf: out.buffer, frames: this.i }, [out.buffer]); this.i = 0; }
  process(inputs) {
    const inp = inputs[0]; if (!inp || !inp.length) return true;
    const n = inp[0].length;
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < this.ch; c++) { let s = inp[Math.min(c, inp.length - 1)][f]; s = s < -1 ? -1 : s > 1 ? 1 : s; this.buf[this.i * this.ch + c] = s < 0 ? s * 0x8000 : s * 0x7fff; }
      if (++this.i === this.tam) this.enviar();
    }
    return true;
  }
}
registerProcessor('captura', Captura);`;

function formatoConsulta() {
  // En iPhone/iPad, m4a (AAC): es lo que mejor reproducen y comparten los aparatos de Apple
  const op = ES_IOS ? ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus'] : ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm'];
  return window.MediaRecorder ? (op.find(m => MediaRecorder.isTypeSupported(m)) || '') : '';
}
const extensionDe = mime => /mp4|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';

function nuevoCodigo(t) { return 'VRG-' + sello(new Date(t)) + '-' + azar(4); }

function fichaVacia(ms) {
  const f = { titulo: t('Grabación {fecha}', { fecha: new Date(ms).toLocaleString(Idioma.locale, { dateStyle: 'short', timeStyle: 'short' }) }), descripcion: '', fechaHora: fechaISO(ms), lugar: '', ubicacion: null,
    participantes: [], lenguas: '', claves: '', transcripcion: { lengua: '', texto: '' }, traducciones: [], fuentes: [], derechos: Ajustes.v.derechos || '',
    consentimiento: { estado: 'pendiente', forma: '', nota: '' }, notas: '', quien: Ajustes.v.quien || '', confidencial: false, uso: '', extra: {} };
  Plantillas.aplicarPredet(f, Plantillas.actual());
  return f;
}

const Grabadora = {
  async iniciar() {
    if (G) return;
    const v = Ajustes.v, conArchivo = v.calidad !== 'consulta', conConsulta = v.calidad !== 'archivo', canales = v.canales === 2 ? 2 : 1;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: {
        deviceId: v.mic ? { exact: v.mic } : undefined, channelCount: { ideal: canales }, sampleRate: { ideal: 48000 },
        echoCancellation: v.eco, noiseSuppression: v.ruido, autoGainControl: v.volAuto } });
    } catch (e) {
      if (v.mic && e.name === 'OverconstrainedError') { Ajustes.v.mic = ''; Ajustes.guardar(); avisar(t('El micrófono elegido no está conectado: usa el predeterminado.')); return this.iniciar(); }
      avisar(t('No se pudo usar el micrófono: {error}. Revisa el permiso del micrófono.', { error: e.message }), 6000); return;
    }
    const track = stream.getAudioTracks()[0], reales = track.getSettings ? track.getSettings() : {};
    // iOS graba a la frecuencia del aparato: pedirle otra puede fallar o dejar el audio en silencio
    let ctx; try { ctx = ES_IOS ? new AudioContext() : new AudioContext({ sampleRate: 48000, latencyHint: 'playback' }); } catch (e) { ctx = new AudioContext(); }
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    const sr = ctx.sampleRate, fuente = ctx.createMediaStreamSource(stream);
    const analizador = ctx.createAnalyser(); analizador.fftSize = 2048; fuente.connect(analizador);
    const ahora = Date.now(), id = nuevoCodigo(ahora);
    G = { id, inicio: ahora, sr, canales, conArchivo, conConsulta, stream, track, ctx, analizador, t0: performance.now(), pausado: 0, pausaDesde: 0,
      frames: 0, pendientes: [], nTrozo: 0, bytesArchivo: 0, bytesConsulta: 0, marcas: [], eventos: [], silencios: [], silencioDesde: null,
      huecos: 0, ultimoGuardado: 0, picoMax: 0, saturado: 0, ultSat: 0, ganancia: 1, ultimoChequeo: performance.now() };
    G.reg = { id, creada: ahora, estado: 'grabando', version: VERSION,
      tecnica: { sr, canales, conArchivo, conConsulta, mime: '', ajustesPedidos: { volAuto: v.volAuto, ruido: v.ruido, eco: v.eco },
        ajustesReales: { sampleRate: reales.sampleRate, channelCount: reales.channelCount, autoGainControl: reales.autoGainControl, noiseSuppression: reales.noiseSuppression, echoCancellation: reales.echoCancellation },
        microfono: track.label || t('predeterminado'), aparato: navigator.userAgent },
      marcas: [], eventos: [], silencios: [], huecos: 0, frames: 0, bytes: { archivo: 0, consulta: 0 }, duracion: 0, clips: [], ficha: fichaVacia(ahora), respaldo: null, modificada: ahora };
    this.evento(t('inicio'), `${sr} Hz · ${canales === 2 ? t('estéreo') : t('mono')}`);

    if (conArchivo) {
      try {
        const url = URL.createObjectURL(new Blob([CODIGO_CAPTURA], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url);
        const nodo = new AudioWorkletNode(ctx, 'captura', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: canales, channelCountMode: 'explicit', processorOptions: { canales } });
        nodo.port.onmessage = e => { if (!G || G.cerrado) return; if (e.data.buf) this.recibir(e.data); else if (e.data.vaciado && G.alVaciar) G.alVaciar(); };
        const mudo = ctx.createGain(); mudo.gain.value = 0;
        fuente.connect(nodo); nodo.connect(mudo); mudo.connect(ctx.destination);
        G.nodo = nodo;
      } catch (e) { this.evento('error', t('no se pudo grabar en calidad de archivo: {error}', { error: e.message })); G.conArchivo = G.reg.tecnica.conArchivo = false; }
    }
    if (conConsulta) {
      const mime = formatoConsulta();
      if (!mime) this.evento('error', t('este navegador no graba en calidad de consulta'));
      else {
        // Volumen automático y limitador SOLO para la consulta
        const g = ctx.createGain(); g.gain.value = 1;
        const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.25;
        const dest = ctx.createMediaStreamDestination(); dest.channelCount = canales;
        fuente.connect(g); g.connect(lim); lim.connect(dest);
        const mr = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: canales === 2 ? 96000 : 48000 });
        mr.ondataavailable = e => { if (e.data && e.data.size) this.guardarTrozo('consulta', e.data); };
        mr.onerror = e => this.evento('error', t('consulta: {error}', { error: e.error && e.error.message }));
        mr.start(2000);
        Object.assign(G, { recorder: mr, gananciaNodo: g }); G.reg.tecnica.mime = mime;
      }
    }
    this.vigilar();
    await this.pantalla(true);
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
    await DB.poner('grabaciones', G.reg);
    G.intervalo = setInterval(() => this.cadaSegundo(), 1000);
    G.cuadro = requestAnimationFrame(() => this.medir());
    $('bGrabar').classList.add('on'); $('bGrabar').innerHTML = '●<br>' + tH('Grabando'); $('bGrabar').setAttribute('aria-pressed', 'true');
    ['bMarcar', 'bPausa', 'bDetener'].forEach(b => $(b).disabled = false);
    vibrar(40);
    this.pintarEstado();
  },

  recibir(d) {
    G.pendientes.push(d.buf); G.frames += d.frames;
    // Silencio absoluto (ceros exactos): ningún micrófono real lo produce; suele ser una llamada u otra app usando el micrófono
    const a = new Int16Array(d.buf); let cero = true;
    for (let i = 0; i < a.length; i += 7) if (a[i] !== 0) { cero = false; break; }
    if (cero && a.every(x => x === 0)) { if (G.silencioDesde == null) G.silencioDesde = (G.frames - d.frames) / G.sr; }
    else if (G.silencioDesde != null) this.cerrarSilencio((G.frames - d.frames) / G.sr);
  },
  cerrarSilencio(hasta) {
    const desde = G.silencioDesde; G.silencioDesde = null;
    if (hasta - desde >= 1) { G.silencios.push({ desde, hasta }); G.reg.silencios = G.silencios; this.evento(t('sin audio'), t('de {desde} a {hasta} (posible llamada u otra app usando el micrófono)', { desde: relojFino(desde), hasta: relojFino(hasta) })); }
  },
  transcurrido() { if (!G) return 0; const p = G.pausaDesde ? performance.now() - G.pausaDesde : 0; return (performance.now() - G.t0 - G.pausado - p) / 1000; },
  segundos() { return G && G.conArchivo ? G.frames / G.sr : this.transcurrido(); },
  evento(tipo, detalle = '') {
    if (!G) return;
    G.eventos.push({ t: Math.round(this.segundos() * 10) / 10, hora: horaBonita(Date.now()), tipo, detalle });
    G.reg.eventos = G.eventos; this.pintarEstado();
  },
  vigilar() {
    G.track.onmute = () => this.evento(t('micrófono ocupado por el sistema'), t('p. ej. una llamada'));
    G.track.onunmute = () => this.evento(t('micrófono de vuelta'));
    G.track.onended = () => this.evento(t('el micrófono se desconectó'));
    G.ctx.onstatechange = () => { this.evento(t('audio del sistema: {estado}', { estado: G.ctx.state })); if (G && G.ctx.state === 'interrupted' && !document.hidden) setTimeout(() => G && G.ctx.resume().catch(() => {}), 800); };
  },
  async pantalla(si) {
    try {
      if (si && G && 'wakeLock' in navigator && !G.wake && !document.hidden) {
        G.wake = await navigator.wakeLock.request('screen');
        G.wake.addEventListener('release', () => { if (G) G.wake = null; });
      } else if (!si && G && G.wake) { await G.wake.release(); G.wake = null; }
    } catch (e) { /* sin pantalla fija: la grabación sigue */ }
    this.pintarEstado();
  },
  async guardarTrozo(tipo, blob, frames = 0) {
    if (!G) return; const id = G.id, n = ++G.nTrozo;
    if (tipo === 'archivo') G.bytesArchivo += blob.size; else G.bytesConsulta += blob.size;
    try { await DB.poner('trozos', { grabacion: id, tipo, n, datos: blob, frames }); G && (G.ultimoGuardado = Date.now()); }
    catch (e) { this.evento(t('error al guardar'), e.message + ' ' + t('(¿espacio lleno?)')); Bitacora.poner('guardar', e.message); avisar(t('⚠️ No se pudo guardar: revisa el espacio del aparato.'), 6000); }
  },
  vaciar() {
    if (!G || !G.pendientes.length) return;
    const partes = G.pendientes; G.pendientes = [];
    const frames = partes.reduce((a, b) => a + b.byteLength, 0) / (2 * G.canales);
    this.guardarTrozo('archivo', new Blob(partes), frames);
  },
  cadaSegundo() {
    if (!G) return;
    $('tiempo').textContent = reloj(this.transcurrido());
    if (performance.now() - G.ultimoChequeo > 2000) {
      G.ultimoChequeo = performance.now();
      this.vaciar();
      Object.assign(G.reg, { frames: G.frames, duracion: this.segundos(), bytes: { archivo: G.bytesArchivo, consulta: G.bytesConsulta }, marcas: G.marcas, modificada: Date.now() });
      DB.poner('grabaciones', G.reg).catch(() => {});
      if (G.conArchivo && !G.pausaDesde && G.ctx.state === 'running') {
        const falta = this.transcurrido() - G.frames / G.sr;
        if (falta > G.huecos + 0.6) { this.evento(t('hueco'), t('faltan {s} s respecto al reloj', { s: falta.toFixed(1) })); G.huecos = falta; G.reg.huecos = falta; }
      }
    }
    this.pintarEstado();
  },
  medir() {
    if (!G) return;
    const a = G.analizador, d = new Float32Array(a.fftSize); a.getFloatTimeDomainData(d);
    let pico = 0, suma = 0; for (const x of d) { const y = Math.abs(x); if (y > pico) pico = y; suma += x * x; }
    const rms = Math.sqrt(suma / d.length), db = x => x > 0 ? 20 * Math.log10(x) : -100, pos = x => Math.max(0, Math.min(100, (db(x) + 60) / 60 * 100));
    $('nivel').style.width = pos(rms) + '%';
    G.picoMax = Math.max(G.picoMax * 0.995, pico); $('pico').style.left = pos(G.picoMax) + '%';
    // Volumen automático de la consulta: sube despacio cuando hay voz, nunca más de 16×; el limitador evita saturar
    if (G.gananciaNodo && !G.pausaDesde && rms > 0.004) {
      const deseada = Math.max(1, Math.min(16, 0.1 / rms));
      G.ganancia = G.ganancia + (deseada - G.ganancia) * (deseada < G.ganancia ? 0.08 : 0.01);
      G.gananciaNodo.gain.setTargetAtTime(G.ganancia, G.ctx.currentTime, 0.3);
    }
    if (pico > 0.98) { if (performance.now() - G.ultSat > 1000) { G.saturado++; G.ultSat = performance.now(); } $('nivelNota').textContent = t('⚠️ Satura: aleja el micrófono'); }
    else if (rms < 0.003 && this.transcurrido() > 3) $('nivelNota').textContent = t('Muy bajo: acerca el micrófono (20–30 cm)');
    else $('nivelNota').textContent = t('Nivel {db} dB', { db: db(rms).toFixed(0) });
    G.cuadro = requestAnimationFrame(() => this.medir());
  },
  /* 1 toque: siguiente clip · 2 toques seguidos: «otra vez» (el intento que termina ahí queda descartado) */
  ultimoToque: 0,
  marcar() {
    if (!G) return;
    const tm = Math.round(this.segundos() * 100) / 100, ahora = performance.now();
    if (ahora - this.ultimoToque < 450 && G.marcas.length) { G.marcas.at(-1).tipo = 'otra vez'; vibrar([30, 60, 30]); avisar(t('↩ Otra vez: ese intento queda descartado'), 1500); }
    else { G.marcas.push({ t: tm, tipo: 'siguiente' }); vibrar(30); }
    this.ultimoToque = ahora; G.reg.marcas = G.marcas; this.pintarEstado();
  },
  async pausa() {
    if (!G) return;
    if (!G.pausaDesde) {
      G.pausaDesde = performance.now();
      if (G.recorder && G.recorder.state === 'recording') G.recorder.pause();
      await G.ctx.suspend().catch(() => {});
      $('bPausa').textContent = t('▶ Seguir'); this.evento(t('pausa'));
    } else {
      await G.ctx.resume().catch(() => {});
      if (G.recorder && G.recorder.state === 'paused') G.recorder.resume();
      G.pausado += performance.now() - G.pausaDesde; G.pausaDesde = 0;
      $('bPausa').textContent = t('⏸ Pausa'); this.evento(t('continúa'));
    }
  },
  async detener() {
    if (!G) return;
    $('bDetener').disabled = true;
    if (G.pausaDesde) await this.pausa();
    this.evento(t('fin'));
    if (G.recorder && G.recorder.state !== 'inactive') await new Promise(ok => { G.recorder.addEventListener('stop', () => setTimeout(ok, 60), { once: true }); G.recorder.stop(); });
    if (G.nodo) await new Promise(ok => { G.alVaciar = ok; G.nodo.port.postMessage('vaciar'); setTimeout(ok, 800); });
    if (G.silencioDesde != null) this.cerrarSilencio(G.frames / G.sr);
    G.cerrado = true; this.vaciar();
    await new Promise(ok => setTimeout(ok, 300));
    clearInterval(G.intervalo); cancelAnimationFrame(G.cuadro);
    G.stream.getTracks().forEach(t => t.stop()); await G.ctx.close().catch(() => {});
    await this.pantalla(false);
    const dur = this.segundos();
    Object.assign(G.reg, { estado: 'lista', fin: Date.now(), duracion: dur, frames: G.frames, bytes: { archivo: G.bytesArchivo, consulta: G.bytesConsulta },
      marcas: G.marcas, eventos: G.eventos, silencios: G.silencios, huecos: G.huecos, saturaciones: G.saturado, clips: clipsDesdeMarcas(G.marcas, dur), modificada: Date.now() });
    if (G.reg.tecnica.mime) G.reg.tecnica.ganancia = Math.round(G.ganancia * 10) / 10;
    await DB.poner('grabaciones', G.reg);
    const id = G.id; G = null;
    $('bGrabar').classList.remove('on'); $('bGrabar').innerHTML = '⏺<br>' + tH('Grabar'); $('bGrabar').setAttribute('aria-pressed', 'false');
    ['bMarcar', 'bPausa', 'bDetener'].forEach(b => $(b).disabled = true);
    $('tiempo').textContent = '00:00:00'; $('nivel').style.width = '0'; $('pico').style.left = '0'; $('nivelNota').textContent = t('Nivel de entrada');
    this.pintarEstado(); vibrar([40, 40, 40]);
    Ficha.abrir(id);
  },
  pintarEstado() {
    if (!G) { $('estadoGrab').innerHTML = ''; return; }
    const seg = G.ultimoGuardado ? Math.round((Date.now() - G.ultimoGuardado) / 1000) : null;
    $('estadoGrab').innerHTML = [
      G.wake ? chip(tH('🔆 Pantalla fija'), 'ok') : chip(tH('🔅 Pantalla sin fijar')),
      G.conArchivo ? chip('🗄️ ' + mb(G.bytesArchivo)) : '', G.recorder ? chip('🔊 ' + mb(G.bytesConsulta)) : '',
      seg != null ? chip(tH('💾 hace {s} s', { s: seg }), seg > 8 ? 'aviso' : 'ok') : chip('💾 …'),
      chip(`🔖 ${G.marcas.length}`), G.huecos > 0.6 ? chip(tH('⚠️ huecos {s} s', { s: G.huecos.toFixed(1) }), 'mal') : '',
      G.silencios.length ? chip(tH('🔇 {n} tramo(s) sin audio', { n: G.silencios.length }), 'aviso') : '', G.pausaDesde ? chip(tH('⏸ En pausa'), 'aviso') : ''
    ].join('');
  }
};

/** Clips a partir de las marcas: cada marca cierra un tramo; «otra vez» lo descarta. */
function clipsDesdeMarcas(marcas, dur) {
  if (!marcas || !marcas.length) return [];
  const cortes = [0, ...marcas.map(m => m.t), dur], clips = [];
  for (let i = 0; i < cortes.length - 1; i++) {
    const desde = cortes[i], hasta = cortes[i + 1];
    if (hasta - desde < 0.15) continue;
    clips.push({ n: clips.length + 1, desde, hasta, etiqueta: '', texto: '', traduccion: '', descartado: i < marcas.length && marcas[i].tipo === 'otra vez' });
  }
  return clips;
}

document.addEventListener('visibilitychange', () => {
  if (!G) return;
  Grabadora.evento(document.hidden ? t('pantalla oculta o bloqueada') : t('pantalla visible'));
  if (document.hidden) Grabadora.vaciar();
  else { Grabadora.pantalla(true); if (G.ctx.state !== 'running' && !G.pausaDesde) G.ctx.resume().catch(() => {}); }
});
window.addEventListener('pagehide', () => { if (G) { Grabadora.evento(t('la app se cerró u ocultó')); Grabadora.vaciar(); } });
window.addEventListener('beforeunload', e => { if (G) { e.preventDefault(); e.returnValue = ''; } });
navigator.mediaDevices && navigator.mediaDevices.addEventListener && navigator.mediaDevices.addEventListener('devicechange', () => G && Grabadora.evento(t('se conectó o desconectó un micrófono')));

/* Grabaciones que no se cerraron (la app se cerró, el aparato se apagó…): se recupera lo guardado */
async function revisarPendientes() {
  const abiertas = (await DB.todas('grabaciones')).filter(r => r.estado === 'grabando' && (!G || r.id !== G.id));
  const b = $('avisoRecuperar');
  if (!abiertas.length) { b.classList.add('oculto'); return; }
  b.classList.remove('oculto');
  b.innerHTML = `${tH('⚠️ {n} grabación(es) no se cerraron. Lo guardado hasta el último momento se puede recuperar.', { n: abiertas.length })}<div class="fila fija"><button class="prim chico" id="bRecuperar">${tH('🛟 Recuperar')}</button></div>`;
  $('bRecuperar').onclick = async () => {
    for (const r of abiertas) {
      const tr = await DB.porGrabacion('trozos', r.id);
      const bytes = tr.filter(x => x.tipo === 'archivo').reduce((a, x) => a + x.datos.size, 0);
      const dur = r.tecnica.conArchivo && bytes ? bytes / (2 * r.tecnica.canales) / r.tecnica.sr : (r.duracion || 0);
      r.eventos = (r.eventos || []).concat([{ t: dur, hora: horaBonita(Date.now()), tipo: t('recuperada'), detalle: t('la grabación se cortó; se recuperó lo guardado') }]);
      Object.assign(r, { estado: 'lista', recuperada: true, duracion: dur, frames: bytes / (2 * r.tecnica.canales), clips: clipsDesdeMarcas((r.marcas || []).filter(m => m.t < dur), dur), modificada: Date.now() });
      await DB.poner('grabaciones', r);
    }
    b.classList.add('oculto'); avisar(t('🛟 Recuperada(s). Están en 📚 Acervo.')); Nav.ir('vAcervo');
  };
}

$('bGrabar').onclick = () => G ? null : Grabadora.iniciar();
$('bMarcar').onclick = () => Grabadora.marcar();
$('bPausa').onclick = () => Grabadora.pausa();
$('bDetener').onclick = () => Grabadora.detener();
