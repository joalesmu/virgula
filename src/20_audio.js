/* ═════════════════ GRABADORA ═════════════════
   Dos caminos a la vez desde el mismo micrófono:
   · archivo: PCM de 16 bits tal como llega (WAV), guardado por partes cada 2 s;
   · consulta: comprimido (Opus/AAC) con volumen automático propio y limitador, SOLO en este camino.
   Así el archivo conserva el sonido real y la consulta se escucha bien. */
let G = null;   // la grabación en curso

const CODIGO_CAPTURA = `
class Captura extends AudioWorkletProcessor {
  constructor(o) {
    super();
    this.ch = o.processorOptions.canales;
    this.tam = Math.round(sampleRate / 10);
    this.buf = new Int16Array(this.tam * this.ch);
    this.i = 0;
    this.baseFrame = null;
    this.inicioFrame = null;
    this.port.onmessage = e => {
      if (e.data && e.data.tipo === 'vaciar') {
        const id = e.data.id;
        this.enviar();
        this.port.postMessage({ vaciado: true, id });
      }
    };
  }
  enviar() {
    if (!this.i) return;
    const out = this.buf.slice(0, this.i * this.ch);
    this.port.postMessage({
      buf: out.buffer,
      frames: this.i,
      inicioFrame: this.inicioFrame
    }, [out.buffer]);
    this.i = 0;
    this.inicioFrame = null;
  }
  process(inputs) {
    const inp = inputs[0];
    if (!inp || !inp.length) return true;
    const n = inp[0].length;
    if (this.baseFrame == null) this.baseFrame = currentFrame;
    for (let f = 0; f < n; f++) {
      if (!this.i) this.inicioFrame = currentFrame + f - this.baseFrame;
      for (let c = 0; c < this.ch; c++) {
        let s = inp[Math.min(c, inp.length - 1)][f];
        s = s < -1 ? -1 : s > 1 ? 1 : s;
        this.buf[this.i * this.ch + c] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
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
  escrituras: new Set(),

    registrarEscritura(promesa) {
    const escritura = Promise.resolve(promesa);

    this.escrituras.add(escritura);

    const retirar = () => this.escrituras.delete(escritura);
    escritura.then(retirar, retirar);

    return escritura;
  },

  async esperarEscrituras() {
    while (this.escrituras.size > 0) {
      await Promise.allSettled([...this.escrituras]);
    }
  },
  
  async iniciar() {
    if (G) return;
    let listaTrabajo = null;
    try { listaTrabajo = await ListaTrabajo.instantaneaSeleccionada(); }
    catch (e) { Bitacora.poner('lista de trabajo', e && e.message ? e.message : String(e)); return avisar(t('No se pudo preparar la lista seleccionada. No se inició la grabación.')); }
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
      frames: 0, pendientes: [], fallidos: [], nTrozo: 0, bytesArchivo: 0, bytesConsulta: 0, marcas: [], eventos: [], silencios: [], silencioDesde: null,
      listaTrabajo, huecos: 0, ultimoGuardado: 0, picoMax: 0, saturado: 0, ultSat: 0, ganancia: 1, ultimoChequeo: performance.now() };
    G.reg = { id, creada: ahora, estado: 'grabando', version: VERSION, listaTrabajo: listaTrabajo ? JSON.parse(JSON.stringify(listaTrabajo)) : null,
      tecnica: { sr, canales, conArchivo, conConsulta, mime: '', ajustesPedidos: { volAuto: v.volAuto, ruido: v.ruido, eco: v.eco },
        ajustesReales: { sampleRate: reales.sampleRate, channelCount: reales.channelCount, autoGainControl: reales.autoGainControl, noiseSuppression: reales.noiseSuppression, echoCancellation: reales.echoCancellation },
        microfono: track.label || t('predeterminado'), aparato: navigator.userAgent },
      marcas: [], eventos: [], silencios: [], huecos: 0, frames: 0, bytes: { archivo: 0, consulta: 0 }, duracion: 0, clips: [], ficha: fichaVacia(ahora), respaldo: null, modificada: ahora };
    // Crear primero la ficha base. Si el almacenamiento no está disponible,
    // no se inicia una captura que después no pueda asociarse a una grabación.
    try {
      await DB.poner('grabaciones', G.reg);
    } catch (e) {
      Bitacora.poner('inicio de grabación', e && e.message ? e.message : String(e));
      stream.getTracks().forEach(x => x.stop());
      await ctx.close().catch(() => {});
      G = null;
      avisar(t('No se pudo crear la ficha inicial en el almacenamiento del aparato. No se inició la grabación.'), 7000);
      return;
    }

    ListaTrabajo.pintarGrabacion();
    this.evento(t('inicio'), `${sr} Hz · ${canales === 2 ? t('estéreo') : t('mono')}`);

    if (conArchivo) {
      try {
        const url = URL.createObjectURL(new Blob([CODIGO_CAPTURA], { type: 'application/javascript' }));
        try {
          await ctx.audioWorklet.addModule(url);
        } finally {
          URL.revokeObjectURL(url);
        }
        const nodo = new AudioWorkletNode(ctx, 'captura', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: canales, channelCountMode: 'explicit', processorOptions: { canales } });
        nodo.port.onmessage = e => {
          if (!G || G.cerrado) return;
        
          if (e.data.buf) {
            this.recibir(e.data);
          } else if (
            e.data.vaciado &&
            e.data.id === G.idVaciado &&
            G.alVaciar
          ) {
            G.alVaciar();
          }
        };
        const mudo = ctx.createGain(); mudo.gain.value = 0;
        fuente.connect(nodo); nodo.connect(mudo); mudo.connect(ctx.destination);
        G.nodo = nodo;
      } catch (e) { this.evento('error', t('no se pudo grabar en calidad de archivo: {error}', { error: e.message })); G.conArchivo = G.reg.tecnica.conArchivo = false; }
    }
    if (conConsulta) {
      const mime = formatoConsulta();
      if (!mime) {
        this.evento('error', t('este navegador no graba en calidad de consulta'));
        G.conConsulta = G.reg.tecnica.conConsulta = false;
      } else {
        try {
          // Volumen automático y limitador SOLO para la consulta
          const g = ctx.createGain(); g.gain.value = 1;
          const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.25;
          const dest = ctx.createMediaStreamDestination(); dest.channelCount = canales;
          fuente.connect(g); g.connect(lim); lim.connect(dest);
          const mr = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: canales === 2 ? 96000 : 48000 });
          mr.ondataavailable = e => { if (e.data && e.data.size) this.guardarTrozo('consulta', e.data); };
          mr.onerror = e => this.evento('error', t('consulta: {error}', { error: e.error && e.error.message }));
          Object.assign(G, { recorder: mr, gananciaNodo: g, destinoConsulta: dest.stream });
          G.reg.tecnica.mime = mime;
          mr.start(2000);
        } catch (e) {
          G.conConsulta = G.reg.tecnica.conConsulta = false;
          G.reg.tecnica.mime = '';
          G.recorder = null;
          if (G.destinoConsulta) G.destinoConsulta.getTracks().forEach(x => x.stop());
          Bitacora.poner('inicio de consulta', e && e.message ? e.message : String(e));
          this.evento('error', t('no se pudo iniciar el audio de consulta: {error}', { error: e.message || String(e) }));
        }
      }
    }

    if (!G.conArchivo && !G.conConsulta) {
      stream.getTracks().forEach(x => x.stop());
      await ctx.close().catch(() => {});
      await DB.quitar('grabaciones', id).catch(() => {});
      G = null;
      avisar(t('Este navegador no pudo iniciar ninguna de las dos formas de captura. No se inició la grabación.'), 7000);
      return;
    }

    this.vigilar();
    await this.pantalla(true);
    G.reg.tecnica.almacenamientoPersistente = false;
    
    try {
      if (navigator.storage && navigator.storage.persist) {
        G.reg.tecnica.almacenamientoPersistente =
          await navigator.storage.persist();
      }
    } catch (e) {
      Bitacora.poner(
        'almacenamiento persistente',
        e && e.message ? e.message : String(e)
      );
    }
    
    try {
      await DB.poner('grabaciones', G.reg);
    } catch (e) {
      // La ficha inicial ya existe; los siguientes guardados volverán a intentarlo.
      Bitacora.poner('actualización de inicio', e && e.message ? e.message : String(e));
      avisar(t('⚠️ La grabación inició, pero no se pudieron actualizar algunos datos técnicos. Se volverán a guardar automáticamente.'), 6000);
    }
    G.intervalo = setInterval(() => this.cadaSegundo(), 1000);
    Atras.abrir();   // «atrás» no saca de la app mientras se graba
    G.cuadro = requestAnimationFrame(() => this.medir());
    // El botón principal pasa a detener cuando la captura ya está lista.
    // Durante la inicialización G existe, pero todavía no debe aceptar el cierre.
    G.interfazActiva = true;
    $('bGrabar').classList.add('on');
    $('bGrabar').innerHTML = tH('⏹ Detener');
    $('bGrabar').setAttribute('aria-label', t('⏹ Detener'));
    $('bGrabar').disabled = false;
    ['bMarcar', 'bRepetirElemento', 'bPausa', 'bDetener'].forEach(b => $(b).disabled = false);
    $('zonaCaptura').classList.add('grabando');
    vibrar(40);
    this.pintarEstado();
  },

  recibir(d) {
    if (!G || G.cerrado || !(d.buf instanceof ArrayBuffer)) return;
    const frames = Number(d.frames);
    if (!Number.isSafeInteger(frames) || frames <= 0 || d.buf.byteLength !== frames * 2 * G.canales) {
      Bitacora.poner('bloque PCM inválido', `${d.buf.byteLength} bytes · ${d.frames} frames`);
      return;
    }

    const inicioFrame = Number.isSafeInteger(d.inicioFrame) && d.inicioFrame >= 0
      ? d.inicioFrame
      : G.frames;

    // No juntar en un mismo fragmento bloques que estén separados en el tiempo.
    if (G.pendientes.length) {
      const ultimo = G.pendientes[G.pendientes.length - 1];
      if (inicioFrame !== ultimo.inicioFrame + ultimo.frames) this.vaciar();
    }

    G.pendientes.push({ buf: d.buf, frames, inicioFrame });
    const finFrame = inicioFrame + frames;
    G.frames = Math.max(G.frames, finFrame);

    // Silencio absoluto (ceros exactos): ningún micrófono real lo produce; suele ser una llamada u otra app usando el micrófono.
    const a = new Int16Array(d.buf);
    let cero = true;
    for (let i = 0; i < a.length; i += 7) {
      if (a[i] !== 0) { cero = false; break; }
    }
    if (cero && a.every(x => x === 0)) {
      if (G.silencioDesde == null) G.silencioDesde = inicioFrame / G.sr;
    } else if (G.silencioDesde != null) {
      this.cerrarSilencio(inicioFrame / G.sr);
    }
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
async guardarTrozo(tipo, blob, frames = 0, inicioFrame = null) {
  if (!G || !blob || !blob.size) return;

  const sesion = G;
  const registro = {
    grabacion: sesion.id,
    tipo,
    n: ++sesion.nTrozo,
    datos: blob,
    frames,
    ...(tipo === 'archivo' && Number.isSafeInteger(inicioFrame) && inicioFrame >= 0
      ? { inicioFrame }
      : {})
  };

  const operacion = (async () => {
    let nombreTemporal = null;
    let respaldadoTemporal = false;
    let guardadoPrincipal = false;

    // 1. Intentar conservar primero una copia temporal en OPFS
    if (RespaldoTemporal.disponible()) {
      try {
        nombreTemporal = await RespaldoTemporal.guardar(registro);
        respaldadoTemporal = true;
      } catch (e) {
        Bitacora.poner(
          'respaldo temporal',
          e && e.message ? e.message : String(e)
        );
      }
    }

    // 2. Guardar el fragmento en IndexedDB
    try {
      await DB.guardarTrozo(registro);
      guardadoPrincipal = true;
    } catch (e) {
      const mensaje = e && e.message ? e.message : String(e);

      Bitacora.poner('guardar IndexedDB', mensaje);

      // Si OPFS ya conservó el audio, no hace falta interrumpir al usuario
      if (!respaldadoTemporal) {
        sesion.fallidos.push({
          ...registro,
          error: mensaje
        });

        if (G === sesion) {
          this.evento(t('error al guardar'), mensaje);

          avisar(
            t('⚠️ No se pudo conservar una parte del audio. Mantén Vírgula abierta.'),
            7000
          );

          this.pintarEstado();
        }
      }
    }

    // 3. Contabilizar una sola vez si existe al menos una copia segura
    if (respaldadoTemporal || guardadoPrincipal) {
      if (tipo === 'archivo') {
        sesion.bytesArchivo += blob.size;
      } else {
        sesion.bytesConsulta += blob.size;
      }

      sesion.ultimoGuardado = Date.now();
    }

    // 4. Eliminar la copia temporal solo después de confirmar IndexedDB
    if (guardadoPrincipal && nombreTemporal) {
      try {
        await RespaldoTemporal.quitar(nombreTemporal);
      } catch (e) {
        // Si no se pudo limpiar, la copia permanece.
        // La recuperación posterior comprobará si ya existe en IndexedDB.
        Bitacora.poner(
          'limpieza respaldo',
          e && e.message ? e.message : String(e)
        );
      }
    }
  })();

  await this.registrarEscritura(operacion);
},

    async reintentarFallidos() {
    if (!G || !G.fallidos.length || G.reintentando) return;

    const sesion = G;
    sesion.reintentando = true;

    try {
      const pendientes = [...sesion.fallidos];

      for (const fallido of pendientes) {
        let nombreTemporal = null;
        let guardadoPrincipal = false;
        let respaldadoTemporal = false;

        try {
          if (RespaldoTemporal.disponible()) {
            try {
              nombreTemporal = await RespaldoTemporal.guardar(fallido);
              respaldadoTemporal = true;
            } catch (e) {
              Bitacora.poner('reintento OPFS', e && e.message ? e.message : String(e));
            }
          }

          try {
            await this.registrarEscritura(DB.guardarTrozo({
              grabacion: fallido.grabacion,
              tipo: fallido.tipo,
              n: fallido.n,
              datos: fallido.datos,
              frames: fallido.frames,
              ...(Number.isSafeInteger(fallido.inicioFrame) ? { inicioFrame: fallido.inicioFrame } : {})
            }));
            guardadoPrincipal = true;
          } catch (e) {
            if (!respaldadoTemporal) throw e;
            Bitacora.poner('reintento IndexedDB', e && e.message ? e.message : String(e));
          }

          if (!guardadoPrincipal && !respaldadoTemporal) {
            throw new Error('No se pudo guardar el fragmento en ningún almacén.');
          }

          if (guardadoPrincipal && nombreTemporal) {
            try {
              await RespaldoTemporal.quitar(nombreTemporal);
            } catch (e) {
              Bitacora.poner('limpieza respaldo', e && e.message ? e.message : String(e));
            }
          }

          const indice = sesion.fallidos.indexOf(fallido);
          if (indice !== -1) sesion.fallidos.splice(indice, 1);

          if (fallido.tipo === 'archivo') sesion.bytesArchivo += fallido.datos.size;
          else sesion.bytesConsulta += fallido.datos.size;
          sesion.ultimoGuardado = Date.now();

        } catch (e) {
          fallido.error = e && e.message ? e.message : String(e);
          Bitacora.poner('reintento', fallido.error);
          break;
        }
      }

    } finally {
      sesion.reintentando = false;

      if (G === sesion) {
        this.pintarEstado();
        if (sesion.capturaDetenida && !sesion.fallidos.length) {
          await this.finalizarDetenida(sesion);
        }
      }
    }
  },

    async finalizarDetenida(sesion) {
    if (
      !sesion ||
      G !== sesion ||
      !sesion.capturaDetenida ||
      sesion.fallidos.length ||
      sesion.finalizando
    ) return;

    sesion.finalizando = true;
    sesion.errorFinalizacion = null;
    this.pintarEstado();

    try {
      // Comprobar que no queden escrituras pendientes
      await this.esperarEscrituras();

      if (G !== sesion || sesion.fallidos.length) return;

      const dur = sesion.duracionFinal;

      Object.assign(sesion.reg, {
        estado: 'lista',
        fin: Date.now(),
        duracion: dur,
        frames: sesion.frames,
        bytes: {
          archivo: sesion.bytesArchivo,
          consulta: sesion.bytesConsulta
        },
        marcas: sesion.marcas,
        eventos: sesion.eventos,
        silencios: sesion.silencios,
        huecos: sesion.huecos,
        saturaciones: sesion.saturado,
        clips: clipsDesdeMarcas(sesion.marcas, dur, sesion.listaTrabajo || null),
        modificada: Date.now()
      });

      if (sesion.reg.tecnica.mime) {
        sesion.reg.tecnica.ganancia =
          Math.round(sesion.ganancia * 10) / 10;
      }

      // La grabación solo se considera terminada tras guardar sus metadatos
      await this.registrarEscritura(
        DB.poner('grabaciones', sesion.reg)
      );

      if (G !== sesion) return;

      const id = sesion.id;
      G = null;
      $('zonaCaptura').classList.remove('grabando');
      ListaTrabajo.pintarGrabacion();

      $('bGrabar').classList.remove('on');
      $('bGrabar').innerHTML = '⏺<br>' + tH('Grabar');
      $('bGrabar').setAttribute('aria-label', t('Grabar'));
      $('bGrabar').disabled = false;

      ['bMarcar', 'bRepetirElemento', 'bPausa', 'bDetener'].forEach(
        b => $(b).disabled = true
      );

      $('tiempo').textContent = '00:00:00';
      $('nivel').style.width = '0';
      $('pico').style.left = '0';
      $('nivelNota').textContent = t('Nivel de entrada');

      this.pintarEstado();
      vibrar([40, 40, 40]);

      try {
        await Ficha.abrir(id);
      } catch (e) {
        Bitacora.poner('abrir ficha', e && e.message ? e.message : String(e));
        avisar(t('La grabación quedó guardada, pero no se pudo abrir su ficha. Está disponible en el Acervo.'), 7000);
        Nav.ir('vAcervo');
      }

    } catch (e) {
      sesion.reg.estado = 'grabando';
      sesion.errorFinalizacion = e && e.message
        ? e.message
        : String(e);

      Bitacora.poner('finalizar', sesion.errorFinalizacion);

      if (G === sesion) {
        // El audio ya está detenido; habilitar ambos accesos para reintentar
        // el guardado final de los metadatos.
        $('bGrabar').disabled = false;
        $('bDetener').disabled = false;
        this.evento(
          t('error al finalizar'),
          sesion.errorFinalizacion
        );

        avisar(
          t('⚠️ No se pudo finalizar la grabación. Los datos guardados se conservan; vuelve a intentarlo.'),
          7000
        );
      }

    } finally {
      sesion.finalizando = false;

      if (G === sesion) {
        this.pintarEstado();
      }
    }
  },
  
  vaciar() {
    if (!G || !G.pendientes.length) return;
    const partes = G.pendientes;
    G.pendientes = [];

    let grupo = [];
    const guardarGrupo = () => {
      if (!grupo.length) return;
      const frames = grupo.reduce((a, b) => a + b.frames, 0);
      const inicioFrame = grupo[0].inicioFrame;
      const blob = new Blob(grupo.map(b => b.buf), { type: 'application/octet-stream' });
      this.guardarTrozo('archivo', blob, frames, inicioFrame);
      grupo = [];
    };

    for (const bloque of partes) {
      const ultimo = grupo[grupo.length - 1];
      if (ultimo && bloque.inicioFrame !== ultimo.inicioFrame + ultimo.frames) guardarGrupo();
      grupo.push(bloque);
    }
    guardarGrupo();
  },
  cadaSegundo() {
    if (!G) return;
    $('tiempo').textContent = reloj(this.transcurrido());
    if (performance.now() - G.ultimoChequeo > 2000) {
      G.ultimoChequeo = performance.now();
      this.vaciar();
      Object.assign(G.reg, { frames: G.frames, duracion: this.segundos(), bytes: { archivo: G.bytesArchivo, consulta: G.bytesConsulta }, marcas: G.marcas, modificada: Date.now() });
      this.registrarEscritura(
      DB.poner('grabaciones', G.reg).catch(e => {
        Bitacora.poner(
          'actualización periódica',
          e && e.message ? e.message : String(e)
        );
      })
    );
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
  /* Una marca cierra el tramo actual. «Otra vez» conserva el mismo elemento de la lista. */
  marcar(tipo = 'siguiente') {
    if (!G || G.cerrado) return;
    const tm = Math.round(this.segundos() * 100) / 100;
    if (G.marcas.length && tm <= G.marcas[G.marcas.length - 1].t) return;
    G.marcas.push({ t: tm, tipo: tipo === 'otra vez' ? 'otra vez' : 'siguiente' });
    G.reg.marcas = G.marcas;
    G.reg.clips = clipsDesdeMarcas(G.marcas, this.segundos(), G.listaTrabajo || null);
    vibrar(tipo === 'otra vez' ? [30, 60, 30] : 30);
    if (tipo === 'otra vez') avisar(t('↩ Se repetirá el mismo elemento.'), 1800);
    this.registrarEscritura(DB.poner('grabaciones', G.reg).catch(e => Bitacora.poner('guardar marca', e && e.message ? e.message : String(e))));
    this.pintarEstado();
    ListaTrabajo.pintarGrabacion();
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
    const sesion = G;
    if (sesion.capturaDetenida) return this.finalizarDetenida(sesion);
    // Los dos botones llaman a esta misma rutina; el cerrojo evita dos cierres
    // simultáneos si la persona pulsa ambos o repite el toque.
    if (sesion.deteniendo) return;
    sesion.deteniendo = true;
    ['bGrabar', 'bMarcar', 'bRepetirElemento', 'bPausa', 'bDetener'].forEach(b => { $(b).disabled = true; });
    if (sesion.pausaDesde) await this.pausa();
    if (!G.finSolicitado) {
    this.evento(t('fin'));
    G.finSolicitado = true;
  }
    clearInterval(G.intervalo);
    cancelAnimationFrame(G.cuadro);
    if (G.nodo) {
      const sesion = G;
      const id = sesion.idVaciado = (sesion.idVaciado || 0) + 1;
    
      try {
        await new Promise((ok, mal) => {
          let timer;
    
          const confirmar = () => {
            clearTimeout(timer);
    
            if (sesion.alVaciar === confirmar) {
              sesion.alVaciar = null;
            }
    
            ok();
          };
    
          sesion.alVaciar = confirmar;
    
          timer = setTimeout(() => {
            if (sesion.alVaciar === confirmar) {
              sesion.alVaciar = null;
            }
    
            mal(new Error('El procesador no confirmó el vaciado.'));
          }, 5000);
    
          try {
            sesion.nodo.port.postMessage({
              tipo: 'vaciar',
              id
            });
          } catch (e) {
            clearTimeout(timer);
            sesion.alVaciar = null;
            mal(e);
          }
        });
    
      } catch (e) {
        Bitacora.poner(
          'cierre de audio',
          e && e.message ? e.message : String(e)
        );
    
        sesion.deteniendo = false;
        $('bMarcar').disabled = true;
        $('bRepetirElemento').disabled = true;
        $('bPausa').disabled = true;
        $('bGrabar').disabled = false;
        $('bDetener').disabled = false;
        // Si el cierre falla, la captura sigue activa: reanudar el guardado periódico
        // para no acumular indefinidamente los siguientes bloques en memoria.
        sesion.intervalo = setInterval(() => this.cadaSegundo(), 1000);
        sesion.cuadro = requestAnimationFrame(() => this.medir());
    
        avisar(
          t('No se pudo confirmar el último bloque de audio. La captura sigue abierta; vuelve a tocar Detener.'),
          7000
        );
    
        return;
      }
    }
    // Cerrar la ruta comprimida solo después de confirmar el último bloque PCM.
    if (G.recorder && G.recorder.state !== 'inactive') {
      try {
        await new Promise((ok, mal) => {
          G.recorder.addEventListener('stop', () => setTimeout(ok, 60), { once: true });
          try {
            G.recorder.stop();
          } catch (e) {
            if (G.recorder.state === 'inactive') ok();
            else mal(e);
          }
        });
      } catch (e) {
        Bitacora.poner('cierre de consulta', e && e.message ? e.message : String(e));
        sesion.deteniendo = false;
        $('bMarcar').disabled = true;
        $('bRepetirElemento').disabled = true;
        $('bPausa').disabled = true;
        $('bGrabar').disabled = false;
        $('bDetener').disabled = false;
        G.intervalo = setInterval(() => this.cadaSegundo(), 1000);
        G.cuadro = requestAnimationFrame(() => this.medir());
        avisar(t('No se pudo cerrar el audio de consulta. La captura sigue abierta; vuelve a tocar Detener.'), 7000);
        return;
      }
    }
    if (G.silencioDesde != null) this.cerrarSilencio(G.frames / G.sr);
    G.cerrado = true;
    this.vaciar();
    await this.esperarEscrituras();
    G.stream.getTracks().forEach(t => t.stop()); await G.ctx.close().catch(() => {});
    await this.pantalla(false);

    sesion.capturaDetenida = true;
    sesion.deteniendo = false;
    sesion.duracionFinal = this.segundos();
    ['bMarcar', 'bPausa', 'bDetener', 'bGrabar'].forEach(b => { $(b).disabled = true; });

    await this.finalizarDetenida(sesion);
  },
  
  pintarEstado() {
  if (!G) { $('estadoGrab').innerHTML = ''; return; }

  const seg = G.ultimoGuardado
    ? Math.round((Date.now() - G.ultimoGuardado) / 1000)
    : null;

  const fallidos = G.fallidos.length;

  $('estadoGrab').innerHTML = [
    G.wake ? chip(tH('🔆 Pantalla fija'), 'ok') : chip(tH('🔅 Pantalla sin fijar')),
    G.conArchivo ? chip('🗄️ ' + mb(G.bytesArchivo)) : '',
    G.recorder ? chip('🔊 ' + mb(G.bytesConsulta)) : '',
    seg != null ? chip(tH('💾 hace {s} s', { s: seg }), seg > 8 ? 'aviso' : 'ok') : chip('💾 …'),
    chip(`🔖 ${G.marcas.length}`),
    G.huecos > 0.6 ? chip(tH('⚠️ huecos {s} s', { s: G.huecos.toFixed(1) }), 'mal') : '',
    G.silencios.length ? chip(tH('🔇 {n} tramo(s) sin audio', { n: G.silencios.length }), 'aviso') : '',
    G.pausaDesde ? chip(tH('⏸ En pausa'), 'aviso') : '',

    fallidos
      ? `<span class="chip mal">⚠️ ${tH('{n} fragmento(s) sin guardar', { n: fallidos })}</span>
         <button type="button" class="chico" id="bReintentarFallidos"
           ${G.reintentando ? 'disabled' : ''}>
           ${tH(G.reintentando ? 'Reintentando…' : '↻ Reintentar guardado')}
         </button>`
      : '',

    G.capturaDetenida && G.errorFinalizacion && !fallidos
      ? `<span class="chip mal">⚠️ ${tH('No se pudo guardar el cierre de la grabación.')}</span>
         <button type="button" class="chico" id="bReintentarFinalizacion"
           ${G.finalizando ? 'disabled' : ''}>
           ${tH(G.finalizando ? 'Guardando…' : '↻ Reintentar finalización')}
         </button>`
      : ''

  ].join('');

  const boton = $('bReintentarFallidos');

  if (boton) {
    boton.onclick = () => {
      boton.disabled = true;
      boton.textContent = t('Reintentando…');
      this.reintentarFallidos();
    };
  }

  const reintentarCierre = $('bReintentarFinalizacion');
  if (reintentarCierre) {
    reintentarCierre.onclick = () => this.finalizarDetenida(G);
  }
  }
};

/** Clips a partir de las marcas: cada marca cierra un tramo; «otra vez» lo descarta. */
function indiceElementoLista(marcas) {
  let indice = 0, inicio = 0;
  for (const marca of (marcas || [])) {
    if (Number(marca.t) - inicio >= 0.15 && marca.tipo !== 'otra vez') indice++;
    inicio = Number(marca.t) || inicio;
  }
  return indice;
}

function clipsDesdeMarcas(marcas, dur, listaTrabajo = null) {
  if (!marcas || !marcas.length) return [];
  const cortes = [0, ...marcas.map(m => m.t), dur], clips = [];
  let indiceLista = 0;
  for (let i = 0; i < cortes.length - 1; i++) {
    const desde = cortes[i], hasta = cortes[i + 1], marcaFin = marcas[i];
    if (hasta - desde < 0.15) continue;
    const elemento = listaTrabajo && listaTrabajo.tipo === 'elementos' ? (listaTrabajo.elementos || [])[indiceLista] : null;
    clips.push({
      n: clips.length + 1, desde, hasta,
      etiqueta: elemento ? elemento.texto : '',
      texto: '', traduccion: '',
      listaId: elemento ? listaTrabajo.id : null,
      listaElementoId: elemento ? elemento.id : null,
      listaIndice: elemento ? indiceLista : null,
      descartado: !!(marcaFin && marcaFin.tipo === 'otra vez')
    });
    if (!marcaFin || marcaFin.tipo !== 'otra vez') indiceLista++;
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

async function revisarPendientes(
  idsConRespaldoPendiente = [],
  recuperacionComprobada = true
) {
  const abiertas = (await DB.todas('grabaciones'))
    .filter(r => r.estado === 'grabando' && (!G || r.id !== G.id));

  const bloqueadas = new Set(idsConRespaldoPendiente);
  const recuperables = abiertas.filter(r => !bloqueadas.has(r.id));
  const b = $('avisoRecuperar');

  // Si no pudimos comprobar OPFS, no arriesgar una recuperación parcial
  if (!recuperacionComprobada) {
    b.classList.remove('oculto');
    b.textContent = t(
      'No se pudo comprobar el estado de los respaldos temporales. No borres los datos de Vírgula.'
    );
    return;
  }

  if (!abiertas.length && !bloqueadas.size) {
    b.classList.add('oculto');
    return;
  }

  b.classList.remove('oculto');

  const avisoTemporal = bloqueadas.size
    ? `<p>${tH('⚠️ Hay audio que todavía no se pudo integrar. Vírgula conserva un respaldo temporal en este dispositivo. No borres sus datos.')}</p>`
    : '';

  const avisoAbiertas = recuperables.length
    ? `<p>${tH('⚠️ {n} grabación(es) no se cerraron. Lo guardado hasta el último momento se puede recuperar.', { n: recuperables.length })}</p>
       <div class="fila fija">
         <button class="prim chico" id="bRecuperar">${tH('🛟 Recuperar')}</button>
       </div>`
    : '';

  b.innerHTML = avisoTemporal + avisoAbiertas;

  if (!recuperables.length) return;

  $('bRecuperar').onclick = async () => {
    const errores = [];
    let completadas = 0;

    for (const original of recuperables) {
      try {
        const r = await DB.leer('grabaciones', original.id);
        if (!r) throw new Error('No se encontró la ficha de esta grabación.');
        const tr = await Medios.trozos(r);
        let plan = null;
        if (tr.archivo.length) plan = Medios.planArchivo(tr.archivo, r);

        const bytesArchivo = plan ? tr.archivo.reduce((a, x) => a + x.datos.size, 0) : 0;
        const bytesConsulta = tr.consulta.reduce((a, x) => a + x.datos.size, 0);
        const dur = plan
          ? plan.frames / plan.sr
          : Math.max(0, Number(r.duracion) || 0);
        const frames = plan
          ? plan.frames
          : (Number.isSafeInteger(r.frames) && r.frames >= 0 ? r.frames : 0);

        r.eventos = (r.eventos || []).concat([{
          t: dur,
          hora: horaBonita(Date.now()),
          tipo: t('recuperada'),
          detalle: t('la grabación se cortó; se recuperó lo guardado')
        }]);

        Object.assign(r, {
          estado: 'lista',
          recuperada: true,
          duracion: dur,
          frames,
          bytes: { archivo: bytesArchivo, consulta: bytesConsulta },
          clips: clipsDesdeMarcas(
            (r.marcas || []).filter(m => Number(m.t) < dur),
            dur,
            r.listaTrabajo || null
          ),
          modificada: Date.now()
        });

        await DB.poner('grabaciones', r);
        completadas++;
      } catch (e) {
        errores.push(original.id);
        Bitacora.poner('recuperar grabación', e && e.message ? e.message : String(e));
      }
    }

    if (errores.length) {
      b.innerHTML = `<p>${tH('⚠️ No se pudieron recuperar {n} grabación(es). Los datos originales se conservan; no borres los datos de Vírgula.', { n: errores.length })}</p>
        <p class="nota">${tH('Grabaciones recuperadas: {n}.', { n: completadas })}</p>
        <div class="fila fija"><button class="prim chico" id="bRecuperarRestantes">${tH('Reintentar recuperación')}</button></div>`;
      $('bRecuperarRestantes').onclick = () => revisarPendientes(
        [...bloqueadas, ...errores],
        recuperacionComprobada
      );
      return;
    }

    b.classList.add('oculto');
    avisar(t('🛟 {n} grabación(es) recuperada(s). Están en 📚 Acervo.', { n: completadas }));
    Nav.ir('vAcervo');
  };
}


$('bGrabar').onclick = () => {
  if (!G) return Grabadora.iniciar();
  // Durante la preparación de la captura se ignoran toques adicionales.
  if (G.interfazActiva) return Grabadora.detener();
};
$('bMarcar').onclick = () => Grabadora.marcar('siguiente');
$('bRepetirElemento').onclick = () => Grabadora.marcar('otra vez');
$('bPausa').onclick = () => Grabadora.pausa();
$('bDetener').onclick = () => Grabadora.detener();

