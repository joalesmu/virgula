/* ═════════════════ MEDIOS: audios de cada grabación, tramos, WAV, Ogg Opus ═════════════════ */
const Medios = {
  cacheDecod: new Map(),
  
async trozos(reg) {
  const trozos = await DB.porGrabacion('trozos', reg.id);
  const temporales = await RespaldoTemporal.listar(reg.id);

  for (const respaldo of temporales) {
    const mime = respaldo.tipo === 'consulta'
      ? ((reg.tecnica && reg.tecnica.mime) || 'application/octet-stream').split(';')[0]
      : 'application/octet-stream';
    const datos = new Blob([respaldo.archivo], { type: mime });
    const coincidencias = trozos.filter(
      x => x.tipo === respaldo.tipo && x.n === respaldo.n
    );

    if (coincidencias.length) {
      for (const existente of coincidencias) {
        if (!await mismosDatos(existente.datos, datos)) {
          Bitacora.poner(
            'conflicto de audio',
            `${reg.id} · ${respaldo.tipo} · ${respaldo.n}`
          );
          throw new Error(
            t('No se pudo comprobar la integridad de uno de los audios. Se conservan ambas copias.')
          );
        }
      }

      const posiciones = coincidencias
        .map(x => x.inicioFrame)
        .filter(Number.isSafeInteger);
      if (new Set(posiciones).size > 1) {
        throw new Error(t('Hay copias del mismo fragmento con posiciones temporales diferentes.'));
      }

      if (Number.isSafeInteger(respaldo.inicioFrame)) {
        if (posiciones.length && posiciones[0] !== respaldo.inicioFrame) {
          throw new Error(t('El respaldo y el fragmento principal tienen posiciones temporales diferentes.'));
        }
        if (!posiciones.length) {
          await DB.fijarInicioFrame(
            reg.id, respaldo.tipo, respaldo.n, respaldo.inicioFrame
          );
          coincidencias.forEach(x => { x.inicioFrame = respaldo.inicioFrame; });
        }
      }

      // Los duplicados idénticos solo se eliminan de esta lectura en memoria.
      const primera = coincidencias[0];
      for (let i = trozos.length - 1; i >= 0; i--) {
        if (
          trozos[i].tipo === respaldo.tipo &&
          trozos[i].n === respaldo.n &&
          trozos[i] !== primera
        ) trozos.splice(i, 1);
      }
      continue;
    }

    let frames = 0;
    if (respaldo.tipo === 'archivo') {
      const canales = reg.tecnica && reg.tecnica.canales;
      if (canales !== 1 && canales !== 2) {
        throw new Error(t('No se pudo determinar el número de canales del audio.'));
      }
      frames = datos.size / (2 * canales);
      if (!Number.isSafeInteger(frames)) {
        throw new Error(t('El tamaño del audio temporal no es válido.'));
      }
    }

    trozos.push({
      grabacion: reg.id,
      tipo: respaldo.tipo,
      n: respaldo.n,
      datos,
      frames,
      ...(Number.isSafeInteger(respaldo.inicioFrame)
        ? { inicioFrame: respaldo.inicioFrame }
        : {}),
      origenTemporal: true
    });
  }

  trozos.sort((a, b) => a.n - b.n);
  return {
    archivo: trozos.filter(x => x.tipo === 'archivo'),
    consulta: trozos.filter(x => x.tipo === 'consulta')
  };
},

  nombreBase(reg) {
    return reg.id + '__' + (nombreArchivo(reg.ficha.titulo, 50) || 'grabacion');
  },

  /** Valida y ordena los fragmentos PCM manteniendo sus posiciones absolutas. */
  planArchivo(fragmentos, reg) {
    const tecnica = reg.tecnica || {};
    const canales = tecnica.canales;
    const sr = tecnica.sr;
    if ((canales !== 1 && canales !== 2) || !Number.isSafeInteger(sr) || sr < 8000) {
      throw new Error(t('La ficha no contiene una frecuencia o cantidad de canales válida.'));
    }

    const unidad = canales * 2;
    const ordenados = [...fragmentos].sort((a, b) => a.n - b.n);
    const partes = [];
    let cursor = 0;

    for (const x of ordenados) {
      if (!x.datos || !Number.isSafeInteger(x.datos.size) || x.datos.size <= 0 || x.datos.size % unidad) {
        throw new Error(t('El fragmento {n} contiene PCM incompleto o inválido.', { n: x.n }));
      }

      const frames = x.datos.size / unidad;
      if (x.frames != null && x.frames !== 0 && x.frames !== frames) {
        throw new Error(t('La duración declarada del fragmento {n} no coincide con sus datos.', { n: x.n }));
      }

      if (x.inicioFrame != null && (!Number.isSafeInteger(x.inicioFrame) || x.inicioFrame < 0)) {
        throw new Error(t('La posición temporal del fragmento {n} no es válida.', { n: x.n }));
      }

      // Los registros antiguos no tenían inicioFrame: se interpretan en secuencia.
      const inicioFrame = x.inicioFrame == null ? cursor : x.inicioFrame;
      const finFrame = inicioFrame + frames;
      if (!Number.isSafeInteger(finFrame) || inicioFrame < cursor) {
        throw new Error(t('Los fragmentos PCM se superponen o exceden el límite temporal en el fragmento {n}.', { n: x.n }));
      }

      partes.push({ ...x, inicioFrame, frames, finFrame });
      cursor = finFrame;
    }

    const declarado = Number.isSafeInteger(reg.frames) && reg.frames >= 0
      ? reg.frames
      : 0;
    const frames = Math.max(cursor, declarado);
    const bytes = frames * unidad;
    if (!Number.isSafeInteger(bytes)) {
      throw new Error(t('La grabación supera el tamaño que puede reconstruirse de forma segura.'));
    }

    return { partes, frames, bytes, canales, sr, unidad };
  },

  /** Construye PCM de un intervalo; las discontinuidades se conservan como silencio digital. */
  pcmDesdePlan(plan, desdeFrame = 0, hastaFrame = plan.frames) {
    const inicio = Math.max(0, Math.min(plan.frames, Math.floor(desdeFrame)));
    const fin = Math.max(inicio, Math.min(plan.frames, Math.floor(hastaFrame)));
    const partes = [];
    const silencio = new Uint8Array(1024 * 1024);
    let cursor = inicio;

    const agregarSilencio = bytes => {
      while (bytes > 0) {
        const n = Math.min(bytes, silencio.byteLength);
        partes.push(silencio.subarray(0, n));
        bytes -= n;
      }
    };

    for (const x of plan.partes) {
      const a = Math.max(inicio, x.inicioFrame);
      const b = Math.min(fin, x.finFrame);
      if (b <= a) continue;
      if (a > cursor) agregarSilencio((a - cursor) * plan.unidad);
      if (a < cursor) {
        throw new Error(t('Se detectó una superposición al reconstruir el audio.'));
      }
      const desplazamiento = (a - x.inicioFrame) * plan.unidad;
      const longitud = (b - a) * plan.unidad;
      partes.push(x.datos.slice(desplazamiento, desplazamiento + longitud));
      cursor = b;
    }

    if (cursor < fin) agregarSilencio((fin - cursor) * plan.unidad);
    return new Blob(partes, { type: 'application/octet-stream' });
  },

  /** Los audios completos de la grabación, como archivos. */
  async archivos(reg, { bwf } = {}) {
    const tr = await this.trozos(reg);
    const r = {};
    const base = this.nombreBase(reg);
    const tecnica = reg.tecnica || {};

    if (tr.archivo.length) {
      const plan = this.planArchivo(tr.archivo, reg);
      const extras = bwf ? metaWav(reg) : [];
      const bytesExtras = extras.reduce((a, x) => a + x.byteLength, 0);
      if (36 + bytesExtras + plan.bytes > 0xffffffff) {
        throw new Error(t('El WAV supera el límite del formato RIFF. Exporta una grabación más corta o solo la consulta.'));
      }
      const pcm = this.pcmDesdePlan(plan);
      r.wav = new File([
        cabeceraWav(plan.bytes, plan.sr, plan.canales, extras),
        pcm
      ], base + '.wav', { type: 'audio/wav' });
    }

    if (tr.consulta.length) {
      const mime = (tecnica.mime || 'audio/webm').split(';')[0];
      let b = new Blob(tr.consulta.map(x => x.datos));
      if (/webm/.test(mime) && reg.duracion) b = await duracionWebm(b, reg.duracion);
      r.consulta = new File([b], base + '.' + extensionDe(tecnica.mime || ''), { type: mime });
    }
    return r;
  },

  /** PCM de un tramo en segundos; conserva silencios y posiciones del audio original. */
  async pcmTramo(reg, desde, hasta) {
    const tecnica = reg.tecnica || {};
    const tr = await this.trozos(reg);
    if (tr.archivo.length) {
      const plan = this.planArchivo(tr.archivo, reg);
      const f0 = Math.max(0, Math.floor(desde * plan.sr));
      const f1 = Math.max(f0, Math.floor(hasta * plan.sr));
      const pcm = this.pcmDesdePlan(plan, f0, f1);
      return {
        pcm: new Int16Array(await pcm.arrayBuffer()),
        sr: plan.sr,
        ch: plan.canales
      };
    }

    const ab = await this.decodificado(reg);
    if (!ab) return null;
    const i0 = Math.max(0, Math.floor(desde * ab.sampleRate));
    const i1 = Math.min(ab.length, Math.max(i0, Math.floor(hasta * ab.sampleRate)));
    const n = Math.max(0, i1 - i0);
    const out = new Int16Array(n * ab.numberOfChannels);
    for (let c = 0; c < ab.numberOfChannels; c++) {
      const d = ab.getChannelData(c);
      for (let i = 0; i < n; i++) {
        let s = d[i0 + i];
        s = s < -1 ? -1 : s > 1 ? 1 : s;
        out[i * ab.numberOfChannels + c] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
    }
    return { pcm: out, sr: ab.sampleRate, ch: ab.numberOfChannels };
  },
  async decodificado(reg) {
    if (this.cacheDecod.has(reg.id)) return this.cacheDecod.get(reg.id);
    if ((reg.duracion || 0) > 40 * 60) throw new Error(t('Para cortar clips de una grabación de más de 40 minutos hace falta la calidad de archivo.'));
    const a = await this.archivos(reg); if (!a.consulta) return null;
    const ctx = new (window.OfflineAudioContext)(reg.tecnica.canales, 48000, 48000);
    const ab = await ctx.decodeAudioData(await a.consulta.arrayBuffer());
    this.cacheDecod.clear(); this.cacheDecod.set(reg.id, ab);
    return ab;
  },
  /** Ajusta el volumen para escuchar: pico a −1 dBFS, sin subir más de 20× (no altera el audio de archivo). */
  normalizar(pcm) {
    let pico = 1; for (let i = 0; i < pcm.length; i++) { const v = Math.abs(pcm[i]); if (v > pico) pico = v; }
    const g = Math.min(20, (0.89 * 32767) / pico); if (g <= 1.05) return pcm;
    const out = new Int16Array(pcm.length); for (let i = 0; i < pcm.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] * g)));
    return out;
  },
  wav(pcm, sr, ch, extras) { return new Blob([cabeceraWav(pcm.byteLength, sr, ch, extras || []), pcm], { type: 'audio/wav' }); },
  /** Ogg Opus con WebCodecs (Chrome, Edge). Devuelve null si el navegador no puede. */
  async ogg(pcm, sr, ch) {
    if (!window.AudioEncoder) return null;
    if (sr !== 48000) { const r = await remuestrear(pcm, sr, ch, 48000); pcm = r; sr = 48000; }
    const config = { codec: 'opus', sampleRate: 48000, numberOfChannels: ch, bitrate: ch === 2 ? 96000 : 48000 };
    try { if (!(await AudioEncoder.isConfigSupported(config)).supported) return null; } catch (e) { return null; }
    const paquetes = []; let preskip = 312, error = null;
    const enc = new AudioEncoder({ output: (chunk, meta) => {
      const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); paquetes.push(b);
      const desc = meta && meta.decoderConfig && meta.decoderConfig.description;
      if (desc) { const d = new Uint8Array(desc.buffer ? desc.buffer.slice(desc.byteOffset || 0, (desc.byteOffset || 0) + desc.byteLength) : desc); if (d.length >= 12 && String.fromCharCode(...d.slice(0, 8)) === 'OpusHead') preskip = d[10] | (d[11] << 8); }
    }, error: e => { error = e; } });
    enc.configure(config);
    const frames = pcm.length / ch, paso = 4800;
    for (let i = 0; i < frames; i += paso) {
      const n = Math.min(paso, frames - i), plano = new Float32Array(n * ch);
      for (let c = 0; c < ch; c++) for (let k = 0; k < n; k++) plano[c * n + k] = pcm[(i + k) * ch + c] / 32768;
      enc.encode(new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(i / 48 * 1000), data: plano }));
    }
    await enc.flush(); enc.close();
    if (error || !paquetes.length) return null;
    return new Blob([muxOgg(paquetes, ch, preskip, frames)], { type: 'audio/ogg' });
  }
};

/** El WebM del navegador no dice cuánto dura (no se puede adelantar en muchos reproductores): se le escribe la duración. */
async function duracionWebm(blob, segundos) {
  try {
    const u = new Uint8Array(await blob.slice(0, Math.min(blob.size, 8192)).arrayBuffer());
    let i = -1; for (let k = 0; k < u.length - 4; k++) if (u[k] === 0x15 && u[k + 1] === 0x49 && u[k + 2] === 0xa9 && u[k + 3] === 0x66) { i = k; break; }
    if (i < 0) return blob;
    const largo = 8 - Math.floor(Math.log2(u[i + 4])); if (largo < 1 || largo > 8) return blob;
    let tam = u[i + 4] & (0xff >> largo); for (let k = 1; k < largo; k++) tam = tam * 256 + u[i + 4 + k];
    const ini = i + 4 + largo, info = u.slice(ini, ini + tam);
    for (let k = 0; k < info.length - 1; k++) if (info[k] === 0x44 && info[k + 1] === 0x89) return blob;   // ya la tiene
    const dur = new Uint8Array(11); dur.set([0x44, 0x89, 0x88]); new DataView(dur.buffer).setFloat64(3, segundos * 1000);
    const nuevo = tam + 11, v = new Uint8Array(8); v[0] = 0x01; for (let k = 7, n = nuevo; k >= 1; k--, n = Math.floor(n / 256)) v[k] = n & 0xff;
    return new Blob([u.slice(0, i + 4), v, info, dur, blob.slice(ini + tam)], { type: blob.type });
  } catch (e) { return blob; }
}

/** Cabecera WAV; «extras» son bloques ya armados (bext, LIST/INFO) que van entre «fmt » y «data». */
function cabeceraWav(bytes, sr, ch, extras = []) {
  const ext = extras.reduce((a, b) => a + b.byteLength, 0), buf = new Uint8Array(44 + ext), h = new DataView(buf.buffer), w = (o, s) => { for (let i = 0; i < s.length; i++) h.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); h.setUint32(4, 36 + ext + bytes, true); w(8, 'WAVE'); w(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true);
  h.setUint16(22, ch, true); h.setUint32(24, sr, true); h.setUint32(28, sr * ch * 2, true); h.setUint16(32, ch * 2, true); h.setUint16(34, 16, true);
  let o = 36; extras.forEach(x => { buf.set(new Uint8Array(x), o); o += x.byteLength; });
  w(o, 'data'); h.setUint32(o + 4, bytes, true);
  return buf.buffer;
}

async function remuestrear(pcm, sr, ch, nuevo) {
  const frames = pcm.length / ch, ctx = new OfflineAudioContext(ch, Math.ceil(frames * nuevo / sr), nuevo);
  const buf = ctx.createBuffer(ch, frames, sr);
  for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < frames; i++) d[i] = pcm[i * ch + c] / 32768; }
  const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start();
  const r = await ctx.startRendering(), out = new Int16Array(r.length * ch);
  for (let c = 0; c < ch; c++) { const d = r.getChannelData(c); for (let i = 0; i < r.length; i++) { const v = Math.max(-1, Math.min(1, d[i])); out[i * ch + c] = v < 0 ? v * 0x8000 : v * 0x7fff; } }
  return out;
}

/* Ogg (RFC 3533) con Opus (RFC 7845). CRC propio de Ogg: polinomio 0x04c11db7, sin reflejar. */
const CRC_OGG = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let r = i << 24; for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1; t[i] = r >>> 0; } return t; })();
function crcOgg(b) { let c = 0; for (let i = 0; i < b.length; i++) c = ((c << 8) ^ CRC_OGG[((c >>> 24) ^ b[i]) & 0xff]) >>> 0; return c; }
function muxOgg(paquetes, ch, preskip, frames) {
  const serie = (Math.random() * 0xffffffff) >>> 0, paginas = []; let seq = 0;
  const pagina = (datos, granulo, tipo) => {
    const lac = []; datos.forEach(d => { let n = d.length; while (n >= 255) { lac.push(255); n -= 255; } lac.push(n); });
    const cuerpo = datos.reduce((a, d) => a + d.length, 0), p = new Uint8Array(27 + lac.length + cuerpo), v = new DataView(p.buffer);
    p.set([79, 103, 103, 83]); p[4] = 0; p[5] = tipo;
    v.setUint32(6, granulo % 0x100000000, true); v.setUint32(10, Math.floor(granulo / 0x100000000), true);
    v.setUint32(14, serie, true); v.setUint32(18, seq++, true); p[26] = lac.length; p.set(lac, 27);
    let o = 27 + lac.length; datos.forEach(d => { p.set(d, o); o += d.length; });
    v.setUint32(22, crcOgg(p), true); paginas.push(p);
  };
  const head = new Uint8Array(19), hv = new DataView(head.buffer);
  head.set([79, 112, 117, 115, 72, 101, 97, 100]); head[8] = 1; head[9] = ch; hv.setUint16(10, preskip, true); hv.setUint32(12, 48000, true); hv.setInt16(16, 0, true); head[18] = 0;
  const vendor = new TextEncoder().encode('Virgula'), tags = new Uint8Array(8 + 4 + vendor.length + 4), tv = new DataView(tags.buffer);
  tags.set([79, 112, 117, 115, 84, 97, 103, 115]); tv.setUint32(8, vendor.length, true); tags.set(vendor, 12); tv.setUint32(12 + vendor.length, 0, true);
  pagina([head], 0, 0x02); pagina([tags], 0, 0);
  let granulo = preskip, grupo = [], segs = 0;
  paquetes.forEach((d, i) => {
    const s = Math.floor(d.length / 255) + 1;
    if (segs + s > 255) { pagina(grupo, Math.min(granulo, preskip + frames), 0); grupo = []; segs = 0; }
    grupo.push(d); segs += s; granulo += 960;
    if (i === paquetes.length - 1) pagina(grupo, preskip + frames, 0x04);
  });
  return new Blob(paginas);
}

