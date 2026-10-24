/* ═════════════════ EXPORTAR: paquetes .zip para archivo, respaldo y catálogo ═════════════════ */
/* ZIP propio, sin compresión (el audio ya viene comprimido o es WAV, y así no se carga todo en memoria). */
const CRC32 = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
async function crc32Blob(b, alAvanzar) {
  let c = 0xffffffff; const paso = 8 * 1048576;
  for (let o = 0; o < b.size; o += paso) {
    const u = new Uint8Array(await b.slice(o, o + paso).arrayBuffer());
    for (let i = 0; i < u.length; i++) c = CRC32[(c ^ u[i]) & 0xff] ^ (c >>> 8);
    alAvanzar && alAvanzar(Math.min(paso, b.size - o));
  }
  return (c ^ 0xffffffff) >>> 0;
}
const ZIP_MAX = 4 * 1024 * 1048576 - 65536;
async function hacerZip(entradas, alAvanzar) {   // entradas: [{ruta, datos: Blob|string, fecha}]
  const partes = [], central = [], enc = new TextEncoder(); let pos = 0;
  for (const e of entradas) {
    const datos = typeof e.datos === 'string' ? new Blob([e.datos]) : e.datos, nombre = enc.encode(e.ruta), crc = await crc32Blob(datos, alAvanzar);
    const d = new Date(e.fecha || Date.now()), hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true);
    loc.setUint16(10, hora, true); loc.setUint16(12, dia, true); loc.setUint32(14, crc, true); loc.setUint32(18, datos.size, true); loc.setUint32(22, datos.size, true);
    loc.setUint16(26, nombre.length, true); loc.setUint16(28, 0, true);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 0x031e, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
    cen.setUint16(12, hora, true); cen.setUint16(14, dia, true); cen.setUint32(16, crc, true); cen.setUint32(20, datos.size, true); cen.setUint32(24, datos.size, true);
    cen.setUint16(28, nombre.length, true); cen.setUint32(38, (0o100644 << 16) >>> 0, true); cen.setUint32(42, pos, true);
    partes.push(loc.buffer, nombre, datos); central.push(cen.buffer, nombre);
    pos += 30 + nombre.length + datos.size;
    if (pos > ZIP_MAX) throw new Error('El paquete pasa de 4 GB. Elige «un paquete por grabación» o menos anexos.');
  }
  const tamCentral = central.reduce((a, b) => a + b.byteLength, 0), fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, entradas.length, true); fin.setUint16(10, entradas.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, pos, true);
  return new Blob([...partes, ...central, fin.buffer], { type: 'application/zip' });
}

const csv = filas => '﻿' + filas.map(f => f.map(v => { const s = v == null ? '' : String(v); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n') + '\r\n';
const etiquetaClip = (c, reg) => nombreArchivo(c.etiqueta, 60) || ('clip ' + c.n);
const rutaClip = (c, reg, ext) => `clips/${etiquetaClip(c, reg)}__${reg.id}-${dos(c.n)}.${ext}`;
/** Nombre del .zip solo con letras básicas: algunos navegadores descartan nombres con ñ, acentos o comillas. */
const ascii = s => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-');
const rutaAdjunto = a => `adjuntos/${a.grabacion}/${a.id}__${nombreArchivo(a.nombre, 80) || 'archivo'}`;

const Exportar = {
  async abrir(ids) {
    if (!ids.length) return avisar('Elige al menos una grabación.');
    const regs = (await Promise.all(ids.map(id => DB.leer('grabaciones', id)))).filter(Boolean);
    const adj = {}; for (const r of regs) adj[r.id] = await DB.porGrabacion('adjuntos', r.id);
    const tam = {}; for (const r of regs) { const tr = await Medios.trozos(r); tam[r.id] = { archivo: tr.archivo.reduce((a, x) => a + x.datos.size, 0), consulta: tr.consulta.reduce((a, x) => a + x.datos.size, 0) }; }
    this.regs = regs; this.adj = adj; this.tam = tam;
    const nAdj = Object.values(adj).reduce((a, l) => a + l.length, 0), nClips = regs.reduce((a, r) => a + (r.clips || []).filter(c => !c.descartado).length, 0);
    const conf = regs.filter(r => r.ficha.confidencial).length, sinCons = regs.filter(r => r.ficha.consentimiento.estado === 'pendiente').length, ogg = !!window.AudioEncoder;
    const op = (n, v, txt, on) => `<label><input type="radio" name="${n}" value="${v}" ${on ? 'checked' : ''}> ${txt}</label>`;
    Ventana.abrir(`<h2>📦 Exportar ${regs.length === 1 ? '«' + esc(regs[0].ficha.titulo) + '»' : regs.length + ' grabaciones'}</h2>
      ${conf ? `<div class="banda aviso">🔒 ${conf} grabación(es) son confidenciales. Comparte el paquete solo con quien deba tenerlo.</div>` : ''}
      ${sinCons ? `<div class="banda aviso">⏳ ${sinCons} grabación(es) tienen el consentimiento pendiente.</div>` : ''}
      <h3>Audio completo</h3><div class="op">
        ${op('eAudio', 'ambos', '🗄️ Archivo (WAV) + 🔊 consulta', true)}${op('eAudio', 'consulta', '🔊 Solo consulta (ligero)')}${op('eAudio', 'archivo', '🗄️ Solo archivo (WAV)')}${op('eAudio', 'ninguno', 'Sin audio completo (solo fichas y clips)')}</div>
      ${nClips ? `<h3>Clips (${nClips})</h3><div class="op">
        ${op('eClips', 'wavogg', '🎯 WAV + Ogg, con nombre de su etiqueta (para el catálogo)', ogg)}${op('eClips', 'wav', 'Solo WAV', !ogg)}${op('eClips', 'no', 'Sin clips')}</div>
        <p class="nota">Los clips salen con el volumen ajustado para escuchar. Su nombre es la etiqueta: el catálogo de lenguas los reconoce con «📥 Traer audios en lote».</p>` : ''}
      ${nAdj ? `<h3>Adjuntos (${nAdj})</h3><div class="op">${op('eAdj', 'todos', 'Todos', true)}${op('eAdj', 'ninguno', 'Ninguno')}${op('eAdj', 'elegir', 'Elegir…')}</div>
        <div id="eAdjLista" class="oculto">${regs.map(r => adj[r.id].length ? `<p class="nota" style="margin:8px 0 2px"><b>${esc(r.ficha.titulo)}</b></p>` + adj[r.id].map(a => `<label class="op"><input type="checkbox" data-eadj="${a.id}" checked> ${iconoDe(a.tipo, a.nombre)} ${esc(a.nombre)} · ${mb(a.tam)}${a.papel === 'consentimiento' ? ' · 🤝' : ''}</label>`).join('') : '').join('')}</div>` : ''}
      ${regs.length > 1 ? `<h3>Empaque</h3><div class="op">${op('eZip', 'uno', 'Un solo paquete', true)}${op('eZip', 'cada', 'Un paquete por grabación')}</div>` : ''}
      <div class="panel" id="eTam" style="margin-top:12px"></div>
      <div id="eProgreso" class="nota"></div>
      <div class="fila"><button class="prim" id="eOk">📦 Preparar y compartir</button><button id="eNo">Cancelar</button></div>`);
    const v = $('velo');
    v.addEventListener('change', e => { if (e.target.name === 'eAdj') $('eAdjLista').classList.toggle('oculto', e.target.value !== 'elegir'); this.estimar(); });
    $('eNo').onclick = () => Ventana.cerrar();
    $('eOk').onclick = () => this.hacer();
    this.estimar();
  },
  opciones() {
    const adjElegidos = new Set([...document.querySelectorAll('[data-eadj]:checked')].map(x => x.dataset.eadj)), modoAdj = leerRadio('eAdj') || 'todos';
    return { audio: leerRadio('eAudio') || 'ambos', clips: leerRadio('eClips') || 'no', zip: leerRadio('eZip') || 'uno',
      adj: a => modoAdj === 'todos' || (modoAdj === 'elegir' && adjElegidos.has(a.id)), modoAdj };
  },
  tamanos(o) {
    return this.regs.map(r => {
      const t = this.tam[r.id], s = r.tecnica.sr, ch = r.tecnica.canales;
      let b = 20000 + (o.audio === 'ambos' || o.audio === 'archivo' ? t.archivo + (t.archivo ? 44 : 0) : 0) + (o.audio === 'ambos' || o.audio === 'consulta' ? t.consulta : 0);
      if (o.clips !== 'no') (r.clips || []).filter(c => !c.descartado).forEach(c => { const d = c.hasta - c.desde; b += d * s * ch * 2 + 44 + (o.clips === 'wavogg' ? d * (ch === 2 ? 12000 : 6000) : 0); });
      this.adj[r.id].filter(o.adj).forEach(a => { b += a.tam; });
      return b;
    });
  },
  estimar() {
    const o = this.opciones(), t = this.tamanos(o), total = t.reduce((a, b) => a + b, 0), mayor = o.zip === 'cada' ? Math.max(...t) : total;
    const canal = mayor < 16 * 1048576 ? ['ok', '✅ Cabe en WhatsApp como documento, correo (hasta ~20 MB) o Drive.']
      : mayor < 100 * 1048576 ? ['ok', '✅ WhatsApp como documento, Drive o cable USB. Para correo es grande: usa Drive.']
      : mayor < 2 * 1024 * 1048576 ? ['aviso', '📁 Mejor Drive, cable USB o memoria. WhatsApp acepta documentos de hasta 2 GB pero puede tardar mucho con datos móviles.']
      : ['mal', '⚠️ Muy grande: elige «un paquete por grabación», «solo consulta» o menos adjuntos. Por cable o Drive con wifi.'];
    $('eTam').innerHTML = `<b>Tamaño aproximado: ${mb(total)}</b>${o.zip === 'cada' && t.length > 1 ? ` · ${t.length} paquetes, el mayor de ${mb(mayor)}` : ''}
      <div class="banda ${canal[0]}" style="margin-top:8px">${canal[1]}</div>
      <p class="nota">Referencia: 1 hora de archivo WAV mono ≈ 330 MB; la consulta ≈ 21 MB. Antes de compartir, el aparato necesita espacio libre parecido al tamaño del paquete.</p>`;
  },
  async hacer() {
    const o = this.opciones(), boton = $('eOk'), prog = $('eProgreso');
    boton.disabled = true;
    try {
      const grupos = o.zip === 'cada' ? this.regs.map(r => [r]) : [this.regs], archivos = [];
      let hecho = 0; const total = this.tamanos(o).reduce((a, b) => a + b, 0), avance = n => { hecho += n; prog.textContent = `Preparando… ${Math.min(99, Math.round(hecho / total * 100))} %`; };
      for (const g of grupos) {
        const entradas = await this.entradas(g, o, txt => { prog.textContent = txt; });
        const zip = await hacerZip(entradas, avance);
        const nombre = g.length === 1 ? `${ascii(Medios.nombreBase(g[0]))}.zip` : `Virgula_${sello(new Date())}_${g.length}_grabaciones.zip`;
        archivos.push(new File([zip], nombre, { type: 'application/zip' }));
      }
      // El menú de compartir pide un toque reciente: por eso se ofrece aquí, con el paquete ya listo
      const puede = navigator.canShare && navigator.canShare({ files: archivos });
      prog.innerHTML = `<div class="banda ok">✅ Listo: ${archivos.length} paquete(s), ${mb(archivos.reduce((a, f) => a + f.size, 0))}.</div>
        <div class="fila"><button class="prim" id="eGuardar">⬇️ Guardar en el aparato</button>${puede ? '<button id="eCompartir">📤 Compartir</button>' : ''}</div>
        <p class="nota">${puede ? '' : 'Este navegador no deja compartir .zip directamente: guárdalo y compártelo desde Descargas o Archivos (WhatsApp, Drive, correo…). '}En la computadora queda en Descargas.</p>`;
      boton.remove();
      const listo = async r => { if (r === 'cancelado') return; await this.marcarRespaldo(o); avisar(r === 'compartido' ? '📦 Paquete compartido.' : '📦 Paquete guardado en Descargas.', 5000); Ventana.cerrar(); if (Nav.actual === 'vAcervo') Acervo.pintar(); };
      $('eGuardar').onclick = async () => listo(await descargarArchivos(archivos));
      if (puede) $('eCompartir').onclick = async () => listo(await compartirArchivos(archivos, 'Vírgula · grabaciones'));
    } catch (e) { prog.textContent = '⚠️ ' + e.message; boton.disabled = false; }
  },
  async marcarRespaldo(o) {
    // Es respaldo completo si van los audios tal como se grabaron y todos los adjuntos
    if (o.audio !== 'ambos' || o.modoAdj !== 'todos') return;
    const ahora = Date.now();
    for (const r of this.regs) { const x = await DB.leer('grabaciones', r.id); if (x) { x.respaldo = ahora; if (x.modificada > ahora) x.modificada = ahora; await DB.poner('grabaciones', x); } }
  },
  /** Todo lo que va dentro de un paquete. */
  async entradas(regs, o, decir) {
    const e = [], datos = [], ahora = Date.now();
    for (const r of regs) {
      decir(`Preparando «${r.ficha.titulo}»…`);
      const a = await Medios.archivos(r), base = Medios.nombreBase(r), rutas = {};
      if (a.wav && (o.audio === 'ambos' || o.audio === 'archivo')) { rutas.archivo = 'audios/' + a.wav.name; e.push({ ruta: rutas.archivo, datos: a.wav, fecha: r.creada }); }
      if (a.consulta && (o.audio === 'ambos' || o.audio === 'consulta')) { rutas.consulta = 'audios/' + a.consulta.name; e.push({ ruta: rutas.consulta, datos: a.consulta, fecha: r.creada }); }
      const clips = [];
      for (const c of (r.clips || [])) {
        const x = Object.assign({}, c);
        if (!c.descartado && o.clips !== 'no') {
          decir(`Cortando clip ${c.n} de «${r.ficha.titulo}»…`);
          const t = await Medios.pcmTramo(r, c.desde, c.hasta);
          if (t && t.pcm.length) {
            const pcm = Medios.normalizar(t.pcm);
            x.archivoWav = rutaClip(c, r, 'wav'); e.push({ ruta: x.archivoWav, datos: Medios.wav(pcm, t.sr, t.ch), fecha: r.creada });
            if (o.clips === 'wavogg') { const ogg = await Medios.ogg(pcm, t.sr, t.ch); if (ogg) { x.archivoOgg = rutaClip(c, r, 'ogg'); e.push({ ruta: x.archivoOgg, datos: ogg, fecha: r.creada }); } }
          }
        }
        clips.push(x);
      }
      const adjuntos = this.adj[r.id].map(ad => { const m = { id: ad.id, nombre: ad.nombre, tipo: ad.tipo, tam: ad.tam, papel: ad.papel, nota: ad.nota, fecha: ad.fecha };
        if (o.adj(ad)) { m.archivo = rutaAdjunto(ad); e.push({ ruta: m.archivo, datos: ad.blob, fecha: ad.fecha }); } else m.noIncluido = true; return m; });
      const copia = JSON.parse(JSON.stringify(r)); delete copia.estado;
      datos.push(Object.assign(copia, { clips, adjuntos, archivos: rutas }));
    }
    const paquete = { formato: FORMATO_PAQUETE, app: 'Vírgula · memoria sonora viva', version: VERSION, exportado: fechaISO(ahora), grabaciones: datos };
    e.unshift({ ruta: 'fichas.json', datos: JSON.stringify(paquete, null, 1), fecha: ahora },
      { ruta: 'fichas.csv', datos: this.csvFichas(datos), fecha: ahora }, { ruta: 'clips.csv', datos: this.csvClips(datos), fecha: ahora },
      { ruta: 'indice.html', datos: indiceHtml(paquete), fecha: ahora }, { ruta: 'LEEME.txt', datos: LEEME, fecha: ahora });
    return e;
  },
  csvFichas(d) {
    const cab = ['codigo', 'titulo', 'fecha_hora', 'duracion_s', 'uso', 'lugar', 'latitud', 'longitud', 'precision_ubicacion', 'lenguas', 'palabras_clave', 'participantes', 'quien_grabo',
      'descripcion', 'transcripcion_lengua', 'transcripcion', 'traducciones', 'fuentes', 'derechos', 'consentimiento', 'consentimiento_forma', 'consentimiento_nota', 'confidencial',
      'notas', 'archivo_wav', 'archivo_consulta', 'adjuntos', 'clips', 'tramos_sin_audio', 'frecuencia_hz', 'canales', 'microfono', 'ajustes_aparato', 'creada', 'modificada'];
    return csv([cab, ...d.map(r => { const f = r.ficha, u = f.ubicacion || {}, t = r.tecnica;
      return [r.id, f.titulo, f.fechaHora, (r.duracion || 0).toFixed(2), USOS[f.uso || ''] && f.uso ? USOS[f.uso] : '', f.lugar, u.lat, u.lon, u.modo, f.lenguas, f.claves,
        (f.participantes || []).map(p => p.nombre + (p.rol ? ' (' + p.rol + ')' : '')).join('; '), f.quien, f.descripcion, f.transcripcion.lengua, f.transcripcion.texto,
        (f.traducciones || []).map(x => `[${x.lengua}${x.autor ? ', ' + x.autor : ''}] ${x.texto}`).join('\n'), (f.fuentes || []).map(x => x.titulo + (x.enlace ? ' <' + x.enlace + '>' : '')).join('; '),
        f.derechos, f.consentimiento.estado, f.consentimiento.forma, f.consentimiento.nota, f.confidencial ? 'sí' : 'no', f.notas, r.archivos.archivo, r.archivos.consulta,
        r.adjuntos.map(a => a.archivo || a.nombre + ' (no incluido)').join('; '), (r.clips || []).filter(c => !c.descartado).length,
        (r.silencios || []).map(s => relojFino(s.desde) + '-' + relojFino(s.hasta)).join('; '), t.sr, t.canales, t.microfono,
        `volumen automático ${t.ajustesPedidos.volAuto ? 'sí' : 'no'}, quitar ruido ${t.ajustesPedidos.ruido ? 'sí' : 'no'}, quitar eco ${t.ajustesPedidos.eco ? 'sí' : 'no'}`, fechaISO(r.creada), fechaISO(r.modificada)]; })]);
  },
  csvClips(d) {
    const filas = [['codigo_grabacion', 'titulo_grabacion', 'clip', 'etiqueta', 'desde_s', 'hasta_s', 'texto', 'traduccion', 'descartado', 'archivo_wav', 'archivo_ogg']];
    d.forEach(r => (r.clips || []).forEach(c => filas.push([r.id, r.ficha.titulo, c.n, c.etiqueta, c.desde.toFixed(2), c.hasta.toFixed(2), c.texto, c.traduccion, c.descartado ? 'sí' : 'no', c.archivoWav, c.archivoOgg])));
    return csv(filas);
  }
};

const LEEME = `VÍRGULA · memoria sonora viva — paquete de grabaciones

Abre indice.html con cualquier navegador para ver las fichas, escuchar los audios y abrir los adjuntos (primero extrae o descomprime el .zip).

Contenido
  indice.html   Las fichas para leer y escuchar, sin conexión.
  fichas.json   Todos los datos, completos. Es lo que lee Vírgula al importar este paquete.
  fichas.csv    Una fila por grabación (se abre en Excel, LibreOffice o Google Sheets).
  clips.csv     Una fila por clip.
  audios/       Audio completo: .wav = archivo (sin alterar, 16 bits); .webm/.m4a/.ogg = consulta (ligero, volumen ajustado).
  clips/        Clips con el nombre de su etiqueta: etiqueta__código-número. El catálogo de lenguas los reconoce con «📥 Traer audios en lote».
  adjuntos/     Fotos, documentos y consentimientos, en una carpeta por grabación.

Para volver a tener estas grabaciones en Vírgula: 📚 Acervo → 📥 Importar paquete.
Respeta las condiciones de consentimiento y derechos anotadas en cada ficha.
`;

/** Página autónoma para leer el paquete sin Vírgula. */
function indiceHtml(p) {
  const rutaAdj = a => a.archivo || '#';
  const t = (s, adj) => textoConEnlaces(s || '', adj, rutaAdj).replace(/\n/g, '<br>');
  const fila = (k, v) => v ? `<tr><th>${k}</th><td>${v}</td></tr>` : '';
  const fichas = p.grabaciones.map(r => {
    const f = r.ficha, u = f.ubicacion, c = f.consentimiento, adj = r.adjuntos;
    const audio = (ruta, tipo) => ruta ? `<p>${tipo}: <a href="${esc(ruta)}">${esc(ruta.split('/').pop())}</a></p><audio controls preload="none" src="${esc(ruta)}"></audio>` : '';
    return `<article id="${r.id}"><h2>${esc(f.titulo)}</h2><p class="m">${r.id} · ${esc(f.fechaHora.replace('T', ' '))} · ${reloj(r.duracion)}${f.confidencial ? ' · 🔒 confidencial' : ''}</p>
      ${audio(r.archivos.consulta, '🔊 Consulta')}${audio(r.archivos.archivo, '🗄️ Archivo')}
      <table>${fila('Descripción', t(f.descripcion, adj))}${fila('Uso', esc(USOS[f.uso || ''] && f.uso ? USOS[f.uso] : ''))}${fila('Lugar', esc(f.lugar))}
      ${fila('Ubicación', u ? `<a href="https://www.openstreetmap.org/?mlat=${u.lat}&mlon=${u.lon}">${u.lat}, ${u.lon}</a> (${esc(u.modo)})` : '')}
      ${fila('Lenguas', esc(f.lenguas))}${fila('Palabras clave', esc(f.claves))}
      ${fila('Participantes', (f.participantes || []).map(x => esc(x.nombre) + (x.rol ? ' — ' + esc(x.rol) : '') + (x.nota ? ' (' + esc(x.nota) + ')' : '')).join('<br>'))}
      ${fila('Grabó', esc(f.quien))}${fila('Derechos', esc(f.derechos))}
      ${fila('Consentimiento', esc(c.estado) + (c.forma ? ' · ' + esc(FORMAS_CONS[c.forma] || c.forma) : '') + (c.nota ? '<br>' + t(c.nota, adj) : ''))}
      ${fila('Fuentes', (f.fuentes || []).map(x => x.enlace ? `<a href="${esc(x.enlace)}">${esc(x.titulo || x.enlace)}</a>` : esc(x.titulo)).join('<br>'))}
      ${fila('Notas', t(f.notas, adj))}${fila('Tramos sin audio', (r.silencios || []).map(s => relojFino(s.desde) + '–' + relojFino(s.hasta)).join(', '))}</table>
      ${f.transcripcion.texto ? `<h3>Transcripción${f.transcripcion.lengua ? ' (' + esc(f.transcripcion.lengua) + ')' : ''}</h3><div class="txt">${t(f.transcripcion.texto, adj)}</div>` : ''}
      ${(f.traducciones || []).map(x => `<h3>Traducción${x.lengua ? ' — ' + esc(x.lengua) : ''}${x.autor ? ' · ' + esc(x.autor) : ''}</h3><div class="txt">${t(x.texto, adj)}</div>`).join('')}
      ${(r.clips || []).some(x => !x.descartado) ? `<h3>Clips</h3><table>${r.clips.filter(x => !x.descartado).map(x => `<tr><th>#${x.n} ${esc(x.etiqueta)}</th><td>${relojFino(x.desde)}–${relojFino(x.hasta)}${x.traduccion ? ' · ' + esc(x.traduccion) : ''}${x.texto ? '<br>' + esc(x.texto) : ''}${x.archivoWav ? `<br><audio controls preload="none" src="${esc(x.archivoOgg || x.archivoWav)}"></audio>` : ''}</td></tr>`).join('')}</table>` : ''}
      ${adj.length ? `<h3>Adjuntos</h3><ul>${adj.map(a => `<li>${a.archivo ? `<a href="${esc(a.archivo)}">${esc(a.nombre)}</a>` : esc(a.nombre) + ' <i>(no incluido)</i>'} · ${esc(PAPELES[a.papel] || a.papel)}${a.nota ? ' — ' + esc(a.nota) : ''}${/^image\//.test(a.tipo) && a.archivo ? `<br><img src="${esc(a.archivo)}" alt="${esc(a.nota || a.nombre)}" loading="lazy">` : ''}</li>`).join('')}</ul>` : ''}
    </article>`;
  }).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vírgula · ${p.grabaciones.length} grabación(es)</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:900px;margin:0 auto;padding:16px;color:#1a1d24;background:#fbfaf6}h1{font-size:24px}article{background:#fff;border:1px solid #ddd;border-radius:12px;padding:16px;margin:16px 0}
.m{color:#666;margin-top:-8px}table{border-collapse:collapse;width:100%}th{text-align:left;vertical-align:top;padding:4px 10px 4px 0;width:28%;color:#444}td{padding:4px 0}audio{width:100%}img{max-width:100%;max-height:320px;margin-top:6px;border-radius:8px}
.txt{white-space:normal;background:#f6f4ee;border-radius:8px;padding:10px}nav a{display:block}@media(prefers-color-scheme:dark){body{background:#12151c;color:#e8e6df}article{background:#1b1f29;border-color:#333}th,.m{color:#aaa}.txt{background:#232836}a{color:#f4c542}}</style></head>
<body><h1>Vírgula · memoria sonora viva</h1><p>${p.grabaciones.length} grabación(es) · exportado el ${esc(p.exportado.replace('T', ' '))} · versión ${esc(p.version)}</p>
<nav>${p.grabaciones.map(r => `<a href="#${r.id}">${esc(r.ficha.titulo)}</a>`).join('')}</nav>${fichas}
<p class="m">Respeta las condiciones de consentimiento y derechos de cada ficha.</p></body></html>`;
}
