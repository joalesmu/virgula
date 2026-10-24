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
    if (pos > ZIP_MAX) throw new Error(t('El paquete pasa de 4 GB. Elige «un paquete por grabación» o menos anexos.'));
  }
  const tamCentral = central.reduce((a, b) => a + b.byteLength, 0), fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, entradas.length, true); fin.setUint16(10, entradas.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, pos, true);
  return new Blob([...partes, ...central, fin.buffer], { type: 'application/zip' });
}

const csv = filas => '﻿' + filas.map(f => f.map(v => { const s = v == null ? '' : String(v); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n') + '\r\n';
const etiquetaClip = c => nombreArchivo(c.etiqueta, 60) || ('clip ' + c.n);
const rutaClip = (c, reg, ext) => `clips/${etiquetaClip(c)}__${reg.id}-${dos(c.n)}.${ext}`;
const rutaAdjunto = a => `adjuntos/${a.grabacion}/${a.id}__${nombreArchivo(a.nombre, 80) || 'archivo'}`;

const Exportar = {
  async abrir(ids) {
    if (!ids.length) return avisar(t('Elige al menos una grabación.'));
    const regs = (await Promise.all(ids.map(id => DB.leer('grabaciones', id)))).filter(Boolean);
    const adj = {}; for (const r of regs) adj[r.id] = await DB.porGrabacion('adjuntos', r.id);
    const tam = {}; for (const r of regs) { const tr = await Medios.trozos(r); tam[r.id] = { archivo: tr.archivo.reduce((a, x) => a + x.datos.size, 0), consulta: tr.consulta.reduce((a, x) => a + x.datos.size, 0) }; }
    this.regs = regs; this.adj = adj; this.tam = tam;
    const nAdj = Object.values(adj).reduce((a, l) => a + l.length, 0), nClips = regs.reduce((a, r) => a + (r.clips || []).filter(c => !c.descartado).length, 0);
    const conf = regs.filter(r => r.ficha.confidencial).length, sinCons = regs.filter(r => r.ficha.consentimiento.estado === 'pendiente').length, ogg = !!window.AudioEncoder;
    const incompletas = regs.filter(r => Plantillas.faltan(r).filter(x => x !== t('Consentimiento')).length).length, hayDwc = regs.some(aplicaDarwin), hayElan = regs.some(tieneElan);
    const op = (n, v, html, on) => `<label><input type="radio" name="${n}" value="${v}" ${on ? 'checked' : ''}> ${html}</label>`;
    const ck = (id, html, on = true) => `<label><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${html}</label>`;
    Ventana.abrir(`<h2>📦 ${regs.length === 1 ? tH('Exportar «{titulo}»', { titulo: regs[0].ficha.titulo }) : tH('Exportar {n} grabaciones', { n: regs.length })}</h2>
      ${conf ? `<div class="banda aviso">${tH('🔒 {n} grabación(es) son confidenciales. Comparte el paquete solo con quien deba tenerlo.', { n: conf })}</div>` : ''}
      ${sinCons ? `<div class="banda aviso">${tH('⏳ {n} grabación(es) tienen el consentimiento pendiente.', { n: sinCons })}</div>` : ''}
      ${incompletas ? `<div class="banda aviso">${tH('📝 {n} ficha(s) tienen datos obligatorios sin llenar.', { n: incompletas })}</div>` : ''}
      <h3>${tH('Audio completo')}</h3><div class="op">
        ${op('eAudio', 'ambos', tH('🗄️ Archivo (WAV) + 🔊 consulta'), true)}${op('eAudio', 'consulta', tH('🔊 Solo consulta (ligero)'))}${op('eAudio', 'archivo', tH('🗄️ Solo archivo (WAV)'))}${op('eAudio', 'ninguno', tH('Sin audio completo (solo fichas y clips)'))}</div>
      ${nClips ? `<h3>${tH('Clips ({n})', { n: nClips })}</h3><div class="op">
        ${op('eClips', 'wavogg', tH('🎯 WAV + Ogg, con nombre de su etiqueta (para el catálogo)'), ogg)}${op('eClips', 'wav', tH('Solo WAV'), !ogg)}${op('eClips', 'no', tH('Sin clips'))}</div>
        <p class="nota">${tH('Los clips salen con el volumen ajustado para escuchar. Su nombre es la etiqueta: el catálogo de lenguas los reconoce con «📥 Traer audios en lote».')}</p>` : ''}
      ${nAdj ? `<h3>${tH('Adjuntos ({n})', { n: nAdj })}</h3><div class="op">${op('eAdj', 'todos', tH('Todos'), true)}${op('eAdj', 'ninguno', tH('Ninguno'))}${op('eAdj', 'elegir', tH('Elegir…'))}</div>
        <div id="eAdjLista" class="oculto">${regs.map(r => adj[r.id].length ? `<p class="nota" style="margin:8px 0 2px"><b>${esc(r.ficha.titulo)}</b></p>` + adj[r.id].map(a => `<label class="op"><input type="checkbox" data-eadj="${a.id}" checked> ${iconoDe(a.tipo, a.nombre)} ${esc(a.nombre)} · ${mb(a.tam)}${a.papel === 'consentimiento' ? ' · 🤝' : ''}</label>`).join('') : '').join('')}</div>` : ''}
      ${regs.length > 1 ? `<h3>${tH('Empaque')}</h3><div class="op">${op('eZip', 'uno', tH('Un solo paquete'), true)}${op('eZip', 'cada', tH('Un paquete por grabación'))}</div>` : ''}
      <details class="sec"><summary>${tH('🏛️ Formatos para archivos e instituciones')}</summary>
        <div class="op">${ck('eBwf', tH('Datos de la ficha dentro de cada WAV (Broadcast WAV)'))}${ck('eDc', tH('Dublin Core (XML) para bibliotecas y repositorios'))}
        ${hayElan ? ck('eElan', tH('ELAN (.eaf): clips y transcripción alineados al audio')) : ''}${hayDwc ? ck('eDwc', tH('Darwin Core para bases de biodiversidad')) : ''}</div>
        <p class="nota">${tH('Siempre van: indice.html para leer sin Vírgula, fichas.json (completo), fichas.csv y clips.csv.')}</p></details>
      <div class="panel" id="eTam" style="margin-top:12px"></div>
      <div id="eProgreso" class="nota"></div>
      <div class="fila"><button class="prim" id="eOk">${tH('📦 Preparar paquete')}</button><button id="eNo">${tH('Cancelar')}</button></div>`);
    const v = $('velo');
    v.addEventListener('change', e => { if (e.target.name === 'eAdj') $('eAdjLista').classList.toggle('oculto', e.target.value !== 'elegir'); this.estimar(); });
    $('eNo').onclick = () => Ventana.cerrar();
    $('eOk').onclick = () => this.hacer();
    this.estimar();
  },
  opciones() {
    const adjElegidos = new Set([...document.querySelectorAll('[data-eadj]:checked')].map(x => x.dataset.eadj)), modoAdj = leerRadio('eAdj') || 'todos', on = id => !!($(id) && $(id).checked);
    return { audio: leerRadio('eAudio') || 'ambos', clips: leerRadio('eClips') || 'no', zip: leerRadio('eZip') || 'uno',
      adj: a => modoAdj === 'todos' || (modoAdj === 'elegir' && adjElegidos.has(a.id)), modoAdj, bwf: on('eBwf'), dc: on('eDc'), elan: on('eElan'), dwc: on('eDwc') };
  },
  tamanos(o) {
    return this.regs.map(r => {
      const tm = this.tam[r.id], s = r.tecnica.sr, ch = r.tecnica.canales;
      let b = 20000 + (o.audio === 'ambos' || o.audio === 'archivo' ? tm.archivo + (tm.archivo ? 44 : 0) : 0) + (o.audio === 'ambos' || o.audio === 'consulta' ? tm.consulta : 0);
      if (o.clips !== 'no') (r.clips || []).filter(c => !c.descartado).forEach(c => { const d = c.hasta - c.desde; b += d * s * ch * 2 + 44 + (o.clips === 'wavogg' ? d * (ch === 2 ? 12000 : 6000) : 0); });
      this.adj[r.id].filter(o.adj).forEach(a => { b += a.tam; });
      return b;
    });
  },
  estimar() {
    const o = this.opciones(), tams = this.tamanos(o), total = tams.reduce((a, b) => a + b, 0), mayor = o.zip === 'cada' ? Math.max(...tams) : total;
    const canal = mayor < 16 * 1048576 ? ['ok', tH('✅ Cabe en WhatsApp como documento, correo (hasta ~20 MB) o Drive.')]
      : mayor < 100 * 1048576 ? ['ok', tH('✅ WhatsApp como documento, Drive o cable USB. Para correo es grande: usa Drive.')]
      : mayor < 2 * 1024 * 1048576 ? ['aviso', tH('📁 Mejor Drive, cable USB o memoria. WhatsApp acepta documentos de hasta 2 GB pero puede tardar mucho con datos móviles.')]
      : ['mal', tH('⚠️ Muy grande: elige «un paquete por grabación», «solo consulta» o menos adjuntos. Por cable o Drive con wifi.')];
    $('eTam').innerHTML = `<b>${tH('Tamaño aproximado: {x}', { x: mb(total) })}</b>${o.zip === 'cada' && tams.length > 1 ? ' · ' + tH('{n} paquetes, el mayor de {x}', { n: tams.length, x: mb(mayor) }) : ''}
      <div class="banda ${canal[0]}" style="margin-top:8px">${canal[1]}</div>
      <p class="nota">${tH('Referencia: 1 hora de archivo WAV mono ≈ 330 MB; la consulta ≈ 21 MB. Antes de compartir, el aparato necesita espacio libre parecido al tamaño del paquete.')}</p>`;
  },
  async hacer() {
    const o = this.opciones(), boton = $('eOk'), prog = $('eProgreso');
    boton.disabled = true;
    try {
      const grupos = o.zip === 'cada' ? this.regs.map(r => [r]) : [this.regs], archivos = [];
      let hecho = 0; const total = this.tamanos(o).reduce((a, b) => a + b, 0), avance = n => { hecho += n; prog.textContent = t('Preparando… {n} %', { n: Math.min(99, Math.round(hecho / total * 100)) }); };
      for (const g of grupos) {
        const entradas = await this.entradas(g, o, txt => { prog.textContent = txt; });
        const zip = await hacerZip(entradas, avance);
        const nombre = g.length === 1 ? `${ascii(Medios.nombreBase(g[0]))}.zip` : `Virgula_${sello(new Date())}_${g.length}_grabaciones.zip`;
        archivos.push(new File([zip], nombre, { type: 'application/zip' }));
      }
      // El menú de compartir pide un toque reciente: por eso se ofrece aquí, con el paquete ya listo
      const puede = navigator.canShare && navigator.canShare({ files: archivos });
      prog.innerHTML = `<div class="banda ok">${tH('✅ Listo: {n} paquete(s), {x}.', { n: archivos.length, x: mb(archivos.reduce((a, f) => a + f.size, 0)) })}</div>
        <div class="fila"><button class="prim" id="eGuardar">${tH('⬇️ Guardar en el aparato')}</button>${puede ? `<button id="eCompartir">${tH('📤 Compartir')}</button>` : ''}</div>
        <p class="nota">${puede ? '' : tH('Este navegador no deja compartir .zip directamente: guárdalo y compártelo desde Descargas o Archivos (WhatsApp, Drive, correo…).') + ' '}${tH('En la computadora queda en Descargas.')}</p>`;
      boton.remove();
      prog.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const listo = async r => {
        if (r === 'cancelado') return;
        await this.marcarRespaldo(o); if (Nav.actual === 'vAcervo') Acervo.pintar(); Recordatorio.revisar();
        if (r === 'compartido') { avisar(t('📦 Paquete compartido.'), 5000); return Ventana.cerrar(); }
        // Guardado: se queda abierta la ventana para ir directo a Descargas y compartir desde ahí
        const android = /Android/i.test(navigator.userAgent);
        prog.innerHTML = `<div class="banda ok">${tH('✅ Guardado en **Descargas**:')}<br>${archivos.map(f => '📦 ' + esc(f.name)).join('<br>')}</div>
          ${android ? `<div class="fila"><a class="boton prim" id="eAbrirDesc" href="intent:#Intent;action=android.intent.action.VIEW_DOWNLOADS;end">${tH('📂 Abrir Descargas')}</a></div>
          <p class="nota">${tH('Ahí, mantén presionado el paquete y toca **Compartir** (WhatsApp, Drive, correo…). Si el botón no abre nada, ve a la app **Archivos** → **Descargas**, o toca el aviso de descarga de Chrome.')}</p>`
          : ES_IOS ? `<p class="nota">${tH('En iPhone o iPad está en la app **Archivos** → **Descargas** (o donde elegiste guardarlo). Ahí, mantén presionado el paquete y toca **Compartir**.')}</p>`
          : `<p class="nota">${tH('Está en la carpeta **Descargas** de la computadora. Desde ahí puedes subirlo a Drive, adjuntarlo a un correo o copiarlo a una memoria.')}</p>`}
          <div class="fila"><button id="eFin">${tH('Listo')}</button><button id="eOtraVez">${tH('⬇️ Guardar otra vez')}</button></div>`;
        prog.scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('eFin').onclick = () => Ventana.cerrar();
        $('eOtraVez').onclick = () => descargarArchivos(archivos);
      };
      $('eGuardar').onclick = async () => listo(await descargarArchivos(archivos));
      if (puede) $('eCompartir').onclick = async () => listo(await compartirArchivos(archivos, 'Vírgula'));
    } catch (e) { prog.textContent = '⚠️ ' + e.message; boton.disabled = false; Bitacora.poner('exportar', e.message); }
  },
  async marcarRespaldo(o) {
    // Es respaldo completo si van los audios tal como se grabaron y todos los adjuntos
    if (o.audio !== 'ambos' || o.modoAdj !== 'todos') return;
    const ahora = Date.now();
    for (const r of this.regs) { const x = await DB.leer('grabaciones', r.id); if (x) { x.respaldo = ahora; if (x.modificada > ahora) x.modificada = ahora; await DB.poner('grabaciones', x); } }
  },
  /** Todo lo que va dentro de un paquete. */
  async entradas(regs, o, decir) {
    const e = [], datos = [], ahora = Date.now(), plantillas = {};
    for (const r of regs) {
      decir(t('Preparando «{titulo}»…', { titulo: r.ficha.titulo }));
      const a = await Medios.archivos(r, { bwf: o.bwf }), rutas = {};
      if (a.wav && (o.audio === 'ambos' || o.audio === 'archivo')) { rutas.archivo = 'audios/' + a.wav.name; e.push({ ruta: rutas.archivo, datos: a.wav, fecha: r.creada }); }
      if (a.consulta && (o.audio === 'ambos' || o.audio === 'consulta')) { rutas.consulta = 'audios/' + a.consulta.name; e.push({ ruta: rutas.consulta, datos: a.consulta, fecha: r.creada }); }
      const clips = [];
      for (const c of (r.clips || [])) {
        const x = Object.assign({}, c);
        if (!c.descartado && o.clips !== 'no') {
          decir(t('Cortando clip {n} de «{titulo}»…', { n: c.n, titulo: r.ficha.titulo }));
          const tr = await Medios.pcmTramo(r, c.desde, c.hasta);
          if (tr && tr.pcm.length) {
            const pcm = Medios.normalizar(tr.pcm);
            x.archivoWav = rutaClip(c, r, 'wav'); e.push({ ruta: x.archivoWav, datos: Medios.wav(pcm, tr.sr, tr.ch, o.bwf ? metaWav(r, c.desde, c.etiqueta || r.ficha.titulo + ' #' + c.n) : []), fecha: r.creada });
            if (o.clips === 'wavogg') { const og = await Medios.ogg(pcm, tr.sr, tr.ch); if (og) { x.archivoOgg = rutaClip(c, r, 'ogg'); e.push({ ruta: x.archivoOgg, datos: og, fecha: r.creada }); } }
          }
        }
        clips.push(x);
      }
      const adjuntos = this.adj[r.id].map(ad => { const m = { id: ad.id, nombre: ad.nombre, tipo: ad.tipo, tam: ad.tam, papel: ad.papel, nota: ad.nota, fecha: ad.fecha };
        if (o.adj(ad)) { m.archivo = rutaAdjunto(ad); e.push({ ruta: m.archivo, datos: ad.blob, fecha: ad.fecha }); } else m.noIncluido = true; return m; });
      const copia = JSON.parse(JSON.stringify(r)); delete copia.estado;
      const pl = Plantillas.de(r.ficha.plantilla && r.ficha.plantilla.id); plantillas[pl.id] = pl;
      datos.push(Object.assign(copia, { clips, adjuntos, archivos: rutas }));
    }
    const lista = Object.values(plantillas).map(p => { const c = JSON.parse(JSON.stringify(p)); delete c.autoria; delete c.modificada; return c; });
    const paquete = { formato: FORMATO_PAQUETE, app: 'Vírgula · memoria sonora viva', version: VERSION, exportado: fechaISO(ahora), idioma: Idioma.codigo, plantillas: lista, grabaciones: datos };
    const fijos = [{ ruta: 'fichas.json', datos: JSON.stringify(paquete, null, 1) }, { ruta: 'fichas.csv', datos: this.csvFichas(datos) }, { ruta: 'clips.csv', datos: this.csvClips(datos) },
      { ruta: 'indice.html', datos: indiceHtml(paquete) }, { ruta: 'LEEME.txt', datos: leeme(o) }];
    if (o.dc) fijos.push({ ruta: 'estandares/dublin_core.xml', datos: dublinCore(datos) });
    if (o.dwc) { const d = darwinCore(datos); if (d) fijos.push({ ruta: 'estandares/darwin_core/occurrence.csv', datos: d.ocurrencias }, { ruta: 'estandares/darwin_core/meta.xml', datos: d.meta }); }
    if (o.elan) datos.filter(tieneElan).forEach(r => fijos.push({ ruta: `elan/${nombreArchivo(Medios.nombreBase(r), 90)}.eaf`, datos: elan(r) }));
    e.unshift(...fijos.map(x => Object.assign(x, { fecha: ahora })));
    return e;
  },
  /** Columnas de los campos propios (de cualquier plantilla) presentes en el paquete. */
  columnasExtra(d) {
    const cols = new Map();
    d.forEach(r => { const p = Plantillas.de(r.ficha.plantilla && r.ficha.plantilla.id);
      Object.keys(r.ficha.extra || {}).forEach(k => { if (cols.has(k)) return; const c = p.campos.find(x => x.id === k); cols.set(k, c ? c.etiqueta : (r.ficha.extraEtiquetas || {})[k] || k); }); });
    return [...cols.entries()];
  },
  csvFichas(d) {
    const extra = this.columnasExtra(d), val = v => Array.isArray(v) ? v.join('; ') : v === true ? 'sí' : v === false ? 'no' : v;
    const cab = ['codigo', 'titulo', 'plantilla', 'fecha_hora', 'duracion_s', 'uso', 'lugar', 'latitud', 'longitud', 'precision_ubicacion', 'lenguas', 'palabras_clave', 'participantes', 'quien_grabo',
      'descripcion', 'transcripcion_lengua', 'transcripcion', 'traducciones', 'fuentes', 'derechos', 'consentimiento', 'consentimiento_forma', 'consentimiento_nota', 'confidencial',
      'notas', 'archivo_wav', 'archivo_consulta', 'adjuntos', 'clips', 'tramos_sin_audio', 'frecuencia_hz', 'canales', 'microfono', 'ajustes_aparato', 'creada', 'modificada', ...extra.map(([k, n]) => 'campo: ' + n)];
    return csv([cab, ...d.map(r => { const f = r.ficha, u = f.ubicacion || {}, tec = r.tecnica;
      return [r.id, f.titulo, f.plantilla ? f.plantilla.nombre : '', f.fechaHora, (r.duracion || 0).toFixed(2), f.uso || '', f.lugar, u.lat, u.lon, u.modo, f.lenguas, f.claves,
        (f.participantes || []).map(p => p.nombre + (p.rol ? ' (' + p.rol + ')' : '')).join('; '), f.quien, f.descripcion, f.transcripcion.lengua, f.transcripcion.texto,
        (f.traducciones || []).map(x => `[${x.lengua}${x.autor ? ', ' + x.autor : ''}] ${x.texto}`).join('\n'), (f.fuentes || []).map(x => x.titulo + (x.enlace ? ' <' + x.enlace + '>' : '')).join('; '),
        f.derechos, f.consentimiento.estado, f.consentimiento.forma, f.consentimiento.nota, f.confidencial ? 'sí' : 'no', f.notas, r.archivos.archivo, r.archivos.consulta,
        r.adjuntos.map(a => a.archivo || a.nombre + ' (no incluido)').join('; '), (r.clips || []).filter(c => !c.descartado).length,
        (r.silencios || []).map(s => relojFino(s.desde) + '-' + relojFino(s.hasta)).join('; '), tec.sr, tec.canales, tec.microfono,
        `volAuto=${tec.ajustesPedidos.volAuto ? 1 : 0}; ruido=${tec.ajustesPedidos.ruido ? 1 : 0}; eco=${tec.ajustesPedidos.eco ? 1 : 0}`, fechaISO(r.creada), fechaISO(r.modificada),
        ...extra.map(([k]) => val((f.extra || {})[k]))]; })]);
  },
  csvClips(d) {
    const filas = [['codigo_grabacion', 'titulo_grabacion', 'clip', 'etiqueta', 'desde_s', 'hasta_s', 'texto', 'traduccion', 'descartado', 'archivo_wav', 'archivo_ogg']];
    d.forEach(r => (r.clips || []).forEach(c => filas.push([r.id, r.ficha.titulo, c.n, c.etiqueta, c.desde.toFixed(2), c.hasta.toFixed(2), c.texto, c.traduccion, c.descartado ? 'sí' : 'no', c.archivoWav, c.archivoOgg])));
    return csv(filas);
  }
};

function leeme(o) {
  return [t('VÍRGULA · memoria sonora viva — paquete de grabaciones'), '',
    t('Abre indice.html con cualquier navegador para ver las fichas, escuchar los audios y abrir los adjuntos (primero extrae o descomprime el .zip).'), '',
    t('Contenido'),
    '  indice.html   ' + t('Las fichas para leer y escuchar, sin conexión.'),
    '  fichas.json   ' + t('Todos los datos, completos. Es lo que lee Vírgula al importar este paquete.'),
    '  fichas.csv    ' + t('Una fila por grabación (se abre en Excel, LibreOffice o Google Sheets).'),
    '  clips.csv     ' + t('Una fila por clip.'),
    '  audios/       ' + t('Audio completo: .wav = archivo (sin alterar, 16 bits); .webm/.m4a/.ogg = consulta (ligero, volumen ajustado).'),
    '  clips/        ' + t('Clips con el nombre de su etiqueta: etiqueta__código-número. El catálogo de lenguas los reconoce con «📥 Traer audios en lote».'),
    '  adjuntos/     ' + t('Fotos, documentos y consentimientos, en una carpeta por grabación.'),
    o.dc || o.dwc ? '  estandares/   ' + t('Dublin Core (dublin_core.xml) y, si aplica, Darwin Core (carpeta darwin_core, lista para GBIF/SNIB).') : '',
    o.elan ? '  elan/         ' + t('Un archivo .eaf por grabación: ábrelo con ELAN junto con la carpeta audios/.') : '',
    o.bwf ? '  ' + t('Los WAV llevan dentro el título, la fecha, el código y los derechos (Broadcast WAV).') : '', '',
    t('Para volver a tener estas grabaciones en Vírgula: 📚 Acervo → 📥 Importar paquete.'),
    t('Respeta las condiciones de consentimiento y derechos anotadas en cada ficha.'), ''].join('\r\n').replace(/(\r\n){3,}/g, '\r\n\r\n');
}

/** Página autónoma para leer el paquete sin Vírgula (en el idioma de la interfaz). */
function indiceHtml(p) {
  const rutaAdj = a => a.archivo || '#';
  const tx = (s, adj) => textoConEnlaces(s || '', adj, rutaAdj).replace(/\n/g, '<br>');
  const fila = (k, v) => v ? `<tr><th>${tH(k)}</th><td>${v}</td></tr>` : '';
  const fichas = p.grabaciones.map(r => {
    const f = r.ficha, u = f.ubicacion, c = f.consentimiento, adj = r.adjuntos, pl = Plantillas.de(f.plantilla && f.plantilla.id);
    const extras = Object.entries(f.extra || {}).filter(([, v]) => !Plantillas.vacio(v)).map(([k, v]) => { const cp = pl.campos.find(x => x.id === k);
      return fila(cp ? cp.etiqueta : (f.extraEtiquetas || {})[k] || k, cp && cp.tipo === 'largo' ? tx(v, adj) : esc(Array.isArray(v) ? v.map(x => t(x)).join(', ') : v === true ? t('sí') : t(String(v)))); }).join('');
    const audio = (ruta, tipo) => ruta ? `<p>${tipo}: <a href="${esc(ruta)}">${esc(ruta.split('/').pop())}</a></p><audio controls preload="none" src="${esc(ruta)}"></audio>` : '';
    return `<article id="${r.id}"><h2>${esc(f.titulo)}</h2><p class="m">${r.id} · ${esc((f.fechaHora || '').replace('T', ' '))} · ${reloj(r.duracion)} · 🧩 ${esc(Plantillas.nombre(pl))}${f.confidencial ? ' · 🔒 ' + tH('confidencial') : ''}</p>
      ${audio(r.archivos.consulta, '🔊 ' + tH('Consulta'))}${audio(r.archivos.archivo, '🗄️ ' + tH('Archivo'))}
      <table>${fila(N_('Descripción'), tx(f.descripcion, adj))}${fila(N_('Uso'), f.uso ? tH(USOS[f.uso] || f.uso) : '')}${fila(N_('Lugar'), esc(f.lugar))}
      ${fila(N_('Ubicación'), u ? `<a href="https://www.openstreetmap.org/?mlat=${u.lat}&mlon=${u.lon}">${u.lat}, ${u.lon}</a> (${esc(u.modo)})` : '')}
      ${fila(N_('Lengua(s) o variante(s)'), esc(f.lenguas))}${fila(N_('Palabras clave'), esc(f.claves))}
      ${fila(N_('Participantes'), (f.participantes || []).map(x => esc(x.nombre) + (x.rol ? ' — ' + esc(x.rol) : '') + (x.nota ? ' (' + esc(x.nota) + ')' : '')).join('<br>'))}
      ${extras}
      ${fila(N_('Quién grabó'), esc(f.quien))}${fila(N_('Derechos y licencia'), esc(f.derechos))}
      ${fila(N_('Consentimiento'), tH(ESTADOS_CONS[c.estado] || c.estado) + (c.forma ? ' · ' + tH(FORMAS_CONS[c.forma] || c.forma) : '') + (c.nota ? '<br>' + tx(c.nota, adj) : ''))}
      ${fila(N_('Fuentes y enlaces'), (f.fuentes || []).map(x => x.enlace ? `<a href="${esc(x.enlace)}">${esc(x.titulo || x.enlace)}</a>` : esc(x.titulo)).join('<br>'))}
      ${fila(N_('Notas'), tx(f.notas, adj))}${fila(N_('Tramos sin audio'), (r.silencios || []).map(s => relojFino(s.desde) + '–' + relojFino(s.hasta)).join(', '))}</table>
      ${f.transcripcion.texto ? `<h3>${tH('Transcripción')}${f.transcripcion.lengua ? ' (' + esc(f.transcripcion.lengua) + ')' : ''}</h3><div class="txt">${tx(f.transcripcion.texto, adj)}</div>` : ''}
      ${(f.traducciones || []).map(x => `<h3>${tH('Traducción')}${x.lengua ? ' — ' + esc(x.lengua) : ''}${x.autor ? ' · ' + esc(x.autor) : ''}</h3><div class="txt">${tx(x.texto, adj)}</div>`).join('')}
      ${(r.clips || []).some(x => !x.descartado) ? `<h3>${tH('Clips')}</h3><table>${r.clips.filter(x => !x.descartado).map(x => `<tr><th>#${x.n} ${esc(x.etiqueta)}</th><td>${relojFino(x.desde)}–${relojFino(x.hasta)}${x.traduccion ? ' · ' + esc(x.traduccion) : ''}${x.texto ? '<br>' + esc(x.texto) : ''}${x.archivoWav ? `<br><audio controls preload="none" src="${esc(x.archivoOgg || x.archivoWav)}"></audio>` : ''}</td></tr>`).join('')}</table>` : ''}
      ${adj.length ? `<h3>${tH('Adjuntos')}</h3><ul>${adj.map(a => `<li>${a.archivo ? `<a href="${esc(a.archivo)}">${esc(a.nombre)}</a>` : esc(a.nombre) + ' <i>(' + tH('no incluido') + ')</i>'} · ${tH(PAPELES[a.papel] || a.papel)}${a.nota ? ' — ' + esc(a.nota) : ''}${/^image\//.test(a.tipo) && a.archivo ? `<br><img src="${esc(a.archivo)}" alt="${esc(a.nota || a.nombre)}" loading="lazy">` : ''}</li>`).join('')}</ul>` : ''}
    </article>`;
  }).join('');
  return `<!doctype html><html lang="${esc(Idioma.codigo)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vírgula · ${tH('{n} grabación(es)', { n: p.grabaciones.length })}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:900px;margin:0 auto;padding:16px;color:#1a1d24;background:#fbfaf6}h1{font-size:24px}article{background:#fff;border:1px solid #ddd;border-radius:12px;padding:16px;margin:16px 0}
.m{color:#666;margin-top:-8px}table{border-collapse:collapse;width:100%}th{text-align:left;vertical-align:top;padding:4px 10px 4px 0;width:28%;color:#444}td{padding:4px 0}audio{width:100%}img{max-width:100%;max-height:320px;margin-top:6px;border-radius:8px}
.txt{white-space:normal;background:#f6f4ee;border-radius:8px;padding:10px}nav a{display:block}@media(prefers-color-scheme:dark){body{background:#12151c;color:#e8e6df}article{background:#1b1f29;border-color:#333}th,.m{color:#aaa}.txt{background:#232836}a{color:#f4c542}}</style></head>
<body><h1>Vírgula · ${tH('memoria sonora viva')}</h1><p>${tH('{n} grabación(es)', { n: p.grabaciones.length })} · ${tH('exportado el {fecha}', { fecha: p.exportado.replace('T', ' ') })} · ${tH('versión')} ${esc(p.version)}</p>
<nav>${p.grabaciones.map(r => `<a href="#${r.id}">${esc(r.ficha.titulo)}</a>`).join('')}</nav>${fichas}
<p class="m">${tH('Respeta las condiciones de consentimiento y derechos de cada ficha.')}</p></body></html>`;
}
