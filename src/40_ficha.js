/* ═════════════════ FICHA: todo lo que acompaña a una grabación ═════════════════ */
const PAPELES = { foto: '📷 Foto', transcripcion: '✍️ Transcripción o traducción', letra: '🎵 Letra, acordes o partitura', apoyo: '📚 Material de apoyo', consentimiento: '🤝 Consentimiento', otro: '📎 Otro' };
const USOS = { '': '— Sin especificar —', lengua: 'Lengua', patrimonio: 'Patrimonio y celebraciones', bitacora: 'Bitácora de campo', naturaleza: 'Sonidos de la naturaleza', entrevista: 'Entrevista o sesión de investigación', otro: 'Otro' };
const ROLES = ['Hablante', 'Cantante', 'Músico', 'Intérprete', 'Traductor', 'Entrevistador', 'Investigador', 'Narrador', 'Otro'];
const FORMAS_CONS = { '': '— Cómo se dio —', oral: 'Oral (grabado)', firma: 'Firma en la pantalla', documento: 'Documento firmado', verbal: 'De palabra, sin registro', comunidad: 'Acuerdo comunitario', otro: 'Otro' };
const iconoDe = (tipo, nombre) => /^image\//.test(tipo) ? '🖼️' : /^audio\//.test(tipo) ? '🔊' : /^video\//.test(tipo) ? '🎞️' : /pdf/.test(tipo) || /\.pdf$/i.test(nombre) ? '📕'
  : /word|\.docx?$|opendocument\.text|\.odt$/i.test(tipo + nombre) ? '📘' : /sheet|excel|\.xlsx?$|\.ods$|\.csv$/i.test(tipo + nombre) ? '📗' : /presentation|powerpoint|\.pptx?$|\.odp$/i.test(tipo + nombre) ? '📙'
  : /^text\//.test(tipo) ? '📄' : /zip|compressed/.test(tipo) ? '🗜️' : '📎';

/** Texto con enlaces: [palabras](adjunto:ID) o [palabras](https://…). Solo eso, más saltos de línea. */
const RE_ENLACE = /\[([^\]\n]{1,200})\]\((adjunto:[\w-]+|https?:\/\/[^\s)]+)\)/g;
function textoConEnlaces(s, adjuntos, rutaAdj) {
  return esc(s).replace(/\[([^\]\n]{1,200})\]\((adjunto:[\w-]+|https?:\/\/[^\s)]+)\)/g, (m, txt, dest) => {
    if (dest.startsWith('adjunto:')) {
      const a = adjuntos.find(x => x.id === dest.slice(8));
      if (!a) return `${txt} <span class="chip mal">adjunto no disponible</span>`;
      return rutaAdj ? `<a href="${esc(rutaAdj(a))}">${txt}</a>` : `<a href="#" data-adj="${a.id}">${txt}</a>`;
    }
    return `<a href="${dest}" target="_blank" rel="noopener">${txt}</a>`;
  });
}

const Ficha = {
  reg: null, adjuntos: [],
  async abrir(id) {
    const reg = await DB.leer('grabaciones', id); if (!reg) return avisar('No se encontró la grabación.');
    this.reg = reg; this.adjuntos = await DB.porGrabacion('adjuntos', id);
    Nav.ir('vFicha'); this.pintar(); this.cargarAudio();
  },
  guardar(inmediato) {
    clearTimeout(this._t);
    const f = async () => { this.reg.modificada = Date.now(); await DB.poner('grabaciones', this.reg); $('fGuardado') && ($('fGuardado').textContent = '💾 Guardado ' + new Date().toLocaleTimeString('es-MX')); };
    if (inmediato) return f(); this._t = setTimeout(f, 500);
  },
  campoTexto(id, etiqueta, valor, { largo, max = 4000, ph = '', enlaces } = {}) {
    return `<label for="${id}">${etiqueta}</label>` + (largo
      ? `<textarea id="${id}" data-c="${id}" maxlength="${max}" placeholder="${esc(ph)}">${esc(valor)}</textarea>${enlaces ? `<div class="fila fija"><button class="chico" data-enlazar="${id}">🔗 Enlazar a un adjunto o página</button></div><div class="vista-texto oculto" id="vista-${id}"></div>` : ''}`
      : `<input type="text" id="${id}" data-c="${id}" maxlength="${max}" value="${esc(valor)}" placeholder="${esc(ph)}">`);
  },
  pintar() {
    const r = this.reg, f = r.ficha, t = r.tecnica, c = f.consentimiento;
    const opts = (o, v) => Object.entries(o).map(([k, n]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('');
    $('vFicha').innerHTML = `
      <div class="fila fija"><button class="chico" id="fVolver">← Acervo</button><span class="nota" id="fGuardado"></span></div>
      <div class="panel">
        <h2>${esc(f.titulo)}</h2>
        <div class="nota">${r.id} · ${fechaBonita(r.creada)} · ${reloj(r.duracion)}</div>
        <div>${t.conArchivo ? chip('🗄️ archivo WAV') : ''}${t.mime ? chip('🔊 consulta') : ''}${chip(t.canales === 2 ? 'estéreo' : 'mono')}${chip(t.sr + ' Hz')}
          ${(r.silencios || []).length ? chip('🔇 ' + r.silencios.length + ' tramo(s) sin audio', 'aviso') : ''}${r.huecos > 0.6 ? chip('⚠️ huecos ' + r.huecos.toFixed(1) + ' s', 'mal') : ''}${r.recuperada ? chip('🛟 recuperada', 'aviso') : ''}</div>
        <div id="fAudios"><p class="nota">Cargando audio…</p></div>
      </div>

      <details class="sec" open><summary>🧾 Ficha</summary>
        ${this.campoTexto('titulo', 'Título *', f.titulo, { max: 200 })}
        ${this.campoTexto('descripcion', 'Descripción', f.descripcion, { largo: true, max: 20000, enlaces: true, ph: 'Qué se grabó, en qué contexto, quiénes participan…' })}
        <div class="fila"><div><label for="fechaHora">Fecha y hora</label><input type="datetime-local" id="fechaHora" data-c="fechaHora" value="${esc(f.fechaHora.slice(0, 16))}"></div>
          <div><label for="uso">Uso</label><select id="uso" data-c="uso">${opts(USOS, f.uso || '')}</select></div></div>
        ${this.campoTexto('lugar', 'Lugar (comunidad, municipio, sitio)', f.lugar, { max: 300 })}
        <div id="fUbic"></div>
        ${this.campoTexto('lenguas', 'Lengua(s) o variante(s)', f.lenguas, { max: 300, ph: 'Ej. wixárika (variante de San Andrés)' })}
        ${this.campoTexto('claves', 'Palabras clave', f.claves, { max: 500, ph: 'Separadas por comas' })}
        <label>Participantes</label><div id="fPart"></div>
        <div class="fila fija"><button class="chico" data-agregar="participantes">＋ Participante</button></div>
        ${this.campoTexto('quien', 'Quién grabó', f.quien, { max: 200 })}
        ${this.campoTexto('derechos', 'Derechos y licencia', f.derechos, { max: 500 })}
        ${this.campoTexto('notas', 'Notas', f.notas, { largo: true, max: 20000, enlaces: true })}
        <div class="op" style="margin-top:10px"><label><input type="checkbox" id="confidencial" ${f.confidencial ? 'checked' : ''}> 🔒 Confidencial</label></div>
        <p class="nota">Confidencial: sin ubicación, participantes solo con código y un aviso antes de exportar.</p>
      </details>

      <details class="sec" ${f.transcripcion.texto || (f.traducciones || []).length ? 'open' : ''}><summary>✍️ Transcripción y traducciones</summary>
        <div class="fila"><div><label for="transLengua">Lengua de la transcripción</label><input type="text" id="transLengua" data-c="transcripcion.lengua" value="${esc(f.transcripcion.lengua)}" maxlength="120"></div></div>
        ${this.campoTexto('transTexto', 'Transcripción (lo que se dice, escrito en su lengua)', f.transcripcion.texto, { largo: true, max: 100000, enlaces: true })}
        <h3>Traducciones</h3><div id="fTrad"></div>
        <div class="fila fija"><button class="chico" data-agregar="traducciones">＋ Traducción</button></div>
      </details>

      <details class="sec" ${(r.clips || []).length ? 'open' : ''}><summary>🔖 Clips (${(r.clips || []).filter(x => !x.descartado).length})</summary>
        <p class="nota">Cada marca cortó un clip. Escribe su etiqueta (por ejemplo, la palabra que se dijo): al exportar, cada clip sale con ese nombre, listo para traerlo al catálogo de lenguas.</p>
        <div id="fClips"></div>
        <div class="fila fija"><button class="chico" id="bClipNuevo">＋ Clip a mano</button></div>
      </details>

      <details class="sec" ${(f.fuentes || []).length ? 'open' : ''}><summary>📚 Fuentes y enlaces</summary>
        <div id="fFuentes"></div>
        <div class="fila fija"><button class="chico" data-agregar="fuentes">＋ Fuente</button></div>
      </details>

      <details class="sec" open><summary>🤝 Consentimiento</summary>
        <div class="op" role="radiogroup">${['pendiente', 'otorgado', 'no aplica'].map(v => `<label><input type="radio" name="consEstado" value="${v}" ${c.estado === v ? 'checked' : ''}> ${{ pendiente: '⏳ Pendiente', otorgado: '✔ Otorgado', 'no aplica': 'No aplica' }[v]}</label>`).join('')}</div>
        <p class="nota">«No aplica» sirve, por ejemplo, para sonidos de la naturaleza o espacios públicos sin personas identificables.</p>
        <div class="fila"><div><label for="consForma">Cómo se dio</label><select id="consForma" data-c="consentimiento.forma">${opts(FORMAS_CONS, c.forma)}</select></div></div>
        ${this.campoTexto('consNota', 'Condiciones o notas (qué usos se aceptaron, quién lo dio…)', c.nota, { largo: true, max: 4000 })}
        <div class="fila"><button class="chico" id="bFirma">✍️ Firmar con el dedo</button><button class="chico" id="bConsOral">🎙️ Grabar consentimiento</button><button class="chico" data-adjuntar="consentimiento">📄 Adjuntar documento</button></div>
      </details>

      <details class="sec" open><summary>📎 Adjuntos (<span id="nAdj">${this.adjuntos.length}</span>)</summary>
        <p class="nota">Fotos, documentos, letras, materiales… de cualquier tipo. Se guarda una copia dentro de Vírgula.</p>
        <div id="fAdj"></div>
        <div class="fila"><button data-adjuntar="">📎 Adjuntar archivo</button><button data-adjuntar="foto" data-camara="1">📷 Tomar foto</button></div>
        <input type="file" id="fileAdj" multiple class="oculto">
      </details>

      <details class="sec"><summary>⚙️ Datos técnicos y eventos</summary>
        <pre>${esc(this.tecnicaTexto())}</pre>
      </details>

      <div class="fila"><button class="prim" id="bExportarUna">📦 Exportar esta grabación</button><button class="peligro" id="bBorrar">🗑 Borrar</button></div>`;
    this.pintarUbic(); this.pintarRep(); this.pintarClips(); this.pintarAdj(); this.vistas();
    $('fVolver').onclick = () => Nav.ir('vAcervo');
    $('bExportarUna').onclick = () => Exportar.abrir([r.id]);
    $('bBorrar').onclick = () => this.borrar();
    $('bClipNuevo').onclick = () => this.clipNuevo();
    $('bFirma').onclick = () => this.firmar();
    $('bConsOral').onclick = () => this.consentimientoOral();
    $('confidencial').onchange = e => { f.confidencial = e.target.checked; if (f.confidencial && f.ubicacion) { f.ubicacion = null; avisar('🔒 Se quitó la ubicación.'); } this.pintarUbic(); this.guardar(); };
    document.querySelectorAll('input[name="consEstado"]').forEach(x => x.onchange = () => { c.estado = x.value; this.guardar(); });
  },
  tecnicaTexto() {
    const r = this.reg, t = r.tecnica;
    return [`Código: ${r.id}`, `Duración: ${reloj(r.duracion)} (${(r.duracion || 0).toFixed(1)} s)`,
      `Archivo WAV: ${t.conArchivo ? 'sí, ' + t.sr + ' Hz, 16 bits, ' + t.canales + ' canal(es)' : 'no'} · Consulta: ${t.mime || 'no'}${t.ganancia ? ' (volumen de consulta ×' + t.ganancia + ')' : ''}`,
      `Ajustes pedidos: volumen automático ${t.ajustesPedidos.volAuto ? 'sí' : 'no'}, quitar ruido ${t.ajustesPedidos.ruido ? 'sí' : 'no'}, quitar eco ${t.ajustesPedidos.eco ? 'sí' : 'no'}`,
      `Ajustes reales del micrófono: ${JSON.stringify(t.ajustesReales)}`, `Micrófono: ${t.microfono}`, `Aparato: ${t.aparato}`, `Versión de Vírgula: ${r.version}`,
      `Saturaciones: ${r.saturaciones || 0} · Huecos: ${(r.huecos || 0).toFixed(1)} s · Tramos sin audio: ${(r.silencios || []).map(s => relojFino(s.desde) + '–' + relojFino(s.hasta)).join(', ') || 'ninguno'}`,
      '', 'Eventos:', ...(r.eventos || []).map(e => `  ${relojFino(e.t)} (${e.hora}) ${e.tipo}${e.detalle ? ' — ' + e.detalle : ''}`)].join('\n');
  },
  async cargarAudio() {
    try {
      const a = await Medios.archivos(this.reg), url = f => URL.createObjectURL(f);
      $('fAudios').innerHTML = [a.consulta ? `<p class="nota" style="margin-top:8px">🔊 Consulta · ${mb(a.consulta.size)}</p><audio controls preload="metadata" src="${url(a.consulta)}" style="width:100%"></audio>` : '',
        a.wav ? `<p class="nota" style="margin-top:8px">🗄️ Archivo (WAV, sin alterar) · ${mb(a.wav.size)}</p><audio controls preload="none" src="${url(a.wav)}" style="width:100%"></audio>` : ''].join('') || '<p class="nota">Sin audio guardado.</p>';
    } catch (e) { $('fAudios').innerHTML = '<p class="nota">No se pudo leer el audio: ' + esc(e.message) + '</p>'; }
  },
  pintarUbic() {
    const f = this.reg.ficha, u = f.ubicacion, modos = { exacta: 'exacta', aprox1: 'aproximada (~1 km)', aprox10: 'aproximada (~10 km)' };
    $('fUbic').innerHTML = f.confidencial ? '<p class="nota">🔒 Confidencial: sin ubicación.</p>' : u
      ? `<p class="nota">📍 ${u.lat}, ${u.lon} · ${modos[u.modo] || u.modo}${u.precisionM ? ' · precisión del aparato ±' + Math.round(u.precisionM) + ' m' : ''} · <a href="https://www.openstreetmap.org/?mlat=${u.lat}&mlon=${u.lon}#map=${u.modo === 'exacta' ? 16 : u.modo === 'aprox1' ? 13 : 10}/${u.lat}/${u.lon}" target="_blank" rel="noopener">ver mapa</a></p><div class="fila fija"><button class="chico" id="bUbic">📍 Volver a tomar</button><button class="chico" id="bUbicQuitar">✕ Quitar ubicación</button></div>`
      : `<div class="fila fija"><button class="chico" id="bUbic">📍 Agregar ubicación</button><select id="ubicModo" style="width:auto">${Object.entries(modos).map(([k, n]) => `<option value="${k}" ${k === Ajustes.v.ubic ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    if ($('bUbic')) $('bUbic').onclick = () => this.ubicar(u ? u.modo : $('ubicModo').value);
    if ($('bUbicQuitar')) $('bUbicQuitar').onclick = () => { f.ubicacion = null; this.pintarUbic(); this.guardar(); };
  },
  ubicar(modo) {
    if (!navigator.geolocation) return avisar('Este aparato no da la ubicación.');
    avisar('📍 Buscando ubicación… puede tardar al aire libre.', 4000);
    navigator.geolocation.getCurrentPosition(p => {
      const dec = modo === 'exacta' ? 6 : modo === 'aprox1' ? 2 : 1, red = x => Number(x.toFixed(dec));
      this.reg.ficha.ubicacion = { lat: red(p.coords.latitude), lon: red(p.coords.longitude), precisionM: modo === 'exacta' ? p.coords.accuracy : null, altitud: modo === 'exacta' && p.coords.altitude != null ? Math.round(p.coords.altitude) : null, modo, fecha: Date.now() };
      this.pintarUbic(); this.guardar(); avisar('📍 Ubicación guardada.');
    }, e => avisar('No se pudo obtener la ubicación: ' + e.message, 5000), { enableHighAccuracy: modo === 'exacta', timeout: 30000, maximumAge: 60000 });
  },
  pintarRep() {
    const f = this.reg.ficha, conf = f.confidencial;
    $('fPart').innerHTML = (f.participantes || []).map((p, i) => `<div class="rep"><div class="fila">
      <input type="text" data-rep="participantes" data-i="${i}" data-k="nombre" value="${esc(p.nombre)}" maxlength="200" placeholder="${conf ? 'Código (p. ej. P01)' : 'Nombre o código'}" aria-label="Nombre">
      <input type="text" data-rep="participantes" data-i="${i}" data-k="rol" value="${esc(p.rol)}" list="dlRoles" placeholder="Rol" aria-label="Rol" style="max-width:180px">
      <button class="chico" data-quitar="participantes" data-i="${i}" aria-label="Quitar">✕</button></div>
      ${conf ? '' : `<input type="text" data-rep="participantes" data-i="${i}" data-k="nota" value="${esc(p.nota || '')}" maxlength="300" placeholder="Comunidad, edad aproximada, otros datos que acepte compartir" style="margin-top:6px">`}</div>`).join('')
      + `<datalist id="dlRoles">${ROLES.map(x => `<option value="${x}">`).join('')}</datalist>`;
    $('fTrad').innerHTML = (f.traducciones || []).map((t, i) => `<div class="rep"><div class="fila">
      <input type="text" data-rep="traducciones" data-i="${i}" data-k="lengua" value="${esc(t.lengua)}" maxlength="120" placeholder="Lengua" aria-label="Lengua">
      <input type="text" data-rep="traducciones" data-i="${i}" data-k="autor" value="${esc(t.autor)}" maxlength="200" placeholder="Quién tradujo" aria-label="Quién tradujo">
      <button class="chico" data-quitar="traducciones" data-i="${i}" aria-label="Quitar">✕</button></div>
      <textarea data-rep="traducciones" data-i="${i}" data-k="texto" id="trad-${i}" maxlength="100000" placeholder="Traducción" style="margin-top:6px">${esc(t.texto)}</textarea>
      <div class="fila fija"><button class="chico" data-enlazar="trad-${i}">🔗 Enlazar</button></div><div class="vista-texto oculto" id="vista-trad-${i}"></div></div>`).join('');
    $('fFuentes').innerHTML = (f.fuentes || []).map((s, i) => `<div class="rep"><div class="fila">
      <input type="text" data-rep="fuentes" data-i="${i}" data-k="titulo" value="${esc(s.titulo)}" maxlength="300" placeholder="Título o referencia" aria-label="Título">
      <button class="chico" data-quitar="fuentes" data-i="${i}" aria-label="Quitar">✕</button></div>
      <input type="url" data-rep="fuentes" data-i="${i}" data-k="enlace" value="${esc(s.enlace)}" maxlength="1000" placeholder="https://… (opcional)" style="margin-top:6px"></div>`).join('');
    this.vistas();
  },
  pintarClips() {
    const clips = this.reg.clips || [];
    $('fClips').innerHTML = clips.length ? clips.map((c, i) => `<div class="clip ${c.descartado ? 'descartado' : ''}">
      <div class="fila fija"><b>#${c.n}</b><span class="t">${relojFino(c.desde)} → ${relojFino(c.hasta)} · ${(c.hasta - c.desde).toFixed(1)} s</span>
        <button class="chico" data-oirclip="${i}">▶ Oír</button>
        <label style="margin:0;display:flex;gap:6px;align-items:center;color:var(--texto)"><input type="checkbox" data-clip="${i}" data-k="descartado" ${c.descartado ? 'checked' : ''}> descartado</label></div>
      <div class="fila"><input type="text" data-clip="${i}" data-k="etiqueta" value="${esc(c.etiqueta)}" maxlength="120" placeholder="Etiqueta (p. ej. la palabra)" aria-label="Etiqueta del clip ${c.n}">
        <input type="text" data-clip="${i}" data-k="traduccion" value="${esc(c.traduccion)}" maxlength="300" placeholder="Traducción (opcional)" aria-label="Traducción"></div>
      <details style="margin-top:4px"><summary class="nota">Ajustar o anotar</summary>
        <div class="fila"><div><label>Desde (s)</label><input type="text" inputmode="decimal" data-clip="${i}" data-k="desde" value="${c.desde.toFixed(2)}"></div><div><label>Hasta (s)</label><input type="text" inputmode="decimal" data-clip="${i}" data-k="hasta" value="${c.hasta.toFixed(2)}"></div></div>
        <input type="text" data-clip="${i}" data-k="texto" value="${esc(c.texto)}" maxlength="2000" placeholder="Transcripción o nota del clip" style="margin-top:6px">
        <div class="fila fija"><button class="chico" data-quitarclip="${i}">✕ Quitar clip</button></div></details>
      <div id="clipAudio-${i}"></div></div>`).join('') : '<p class="nota">Sin clips: esta grabación no tiene marcas. Puedes cortar clips a mano.</p>';
  },
  pintarAdj() {
    $('nAdj').textContent = this.adjuntos.length;
    $('fAdj').innerHTML = this.adjuntos.length ? this.adjuntos.map(a => `<div class="adj"><span class="ico">${iconoDe(a.tipo, a.nombre)}</span>
      <div class="info"><b>${esc(a.nombre)}</b><span class="nota">${mb(a.tam)}</span>
        <select data-adjk="papel" data-id="${a.id}" style="margin-top:4px">${Object.entries(PAPELES).map(([k, n]) => `<option value="${k}" ${k === a.papel ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <input type="text" data-adjk="nota" data-id="${a.id}" value="${esc(a.nota || '')}" maxlength="500" placeholder="Nota (qué es, quién lo hizo…)" style="margin-top:4px">
        <div class="fila fija"><button class="chico" data-adj="${a.id}">👁 Abrir</button><button class="chico" data-quitaradj="${a.id}">✕ Quitar</button></div></div></div>`).join('') : '<p class="nota">Sin adjuntos.</p>';
  },
  vistas() {
    document.querySelectorAll('#vFicha textarea').forEach(t => {
      const v = $('vista-' + t.id); if (!v) return;
      const tiene = RE_ENLACE.test(t.value); RE_ENLACE.lastIndex = 0;
      v.classList.toggle('oculto', !tiene); if (tiene) v.innerHTML = '🔗 ' + textoConEnlaces(t.value, this.adjuntos);
    });
  },
  /* ── Edición ── */
  poner(ruta, valor) {
    const f = this.reg.ficha, mapa = { transLengua: 'transcripcion.lengua', transTexto: 'transcripcion.texto', consNota: 'consentimiento.nota' };
    const p = (mapa[ruta] || ruta).split('.'); let o = f; for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p.at(-1)] = ruta === 'fechaHora' ? (valor ? valor + ':00' : '') : valor;
    this.guardar();
  },
  async agregarAdjuntos(archivos, papel) {
    let n = 0;
    for (const f of archivos) {
      const a = { id: 'A' + Date.now().toString(36) + azar(4), grabacion: this.reg.id, nombre: f.name || ('adjunto-' + n), tipo: f.type || '', tam: f.size,
        papel: papel || (/^image\//.test(f.type) ? 'foto' : 'otro'), nota: '', blob: f, fecha: Date.now() };
      try { await DB.poner('adjuntos', a); this.adjuntos.push(a); n++; } catch (e) { avisar('No se pudo guardar «' + f.name + '»: ' + e.message, 5000); }
    }
    if (n) { this.reg.modificada = Date.now(); await this.guardar(true); this.pintarAdj(); avisar(`📎 ${n} adjunto(s) guardado(s).`); }
  },
  abrirAdjunto(id) {
    const a = this.adjuntos.find(x => x.id === id); if (!a) return;
    const url = URL.createObjectURL(new File([a.blob], a.nombre, { type: a.tipo || 'application/octet-stream' }));
    if (/^(image|audio|video|text)\/|pdf/.test(a.tipo)) window.open(url, '_blank');
    else { const l = document.createElement('a'); l.href = url; l.download = a.nombre; document.body.appendChild(l); l.click(); l.remove(); }
  },
  async quitarAdjunto(id) {
    const a = this.adjuntos.find(x => x.id === id); if (!a || !confirm(`¿Quitar «${a.nombre}» de esta grabación?`)) return;
    await DB.quitar('adjuntos', id); this.adjuntos = this.adjuntos.filter(x => x.id !== id);
    this.reg.modificada = Date.now(); await this.guardar(true); this.pintarAdj(); this.vistas();
  },
  enlazar(idCampo) {
    const t = $(idCampo); if (!t) return;
    const sel = t.value.slice(t.selectionStart, t.selectionEnd), ini = t.selectionStart, fin = t.selectionEnd;
    const v = Ventana.abrir(`<h2>🔗 Enlazar</h2>
      <label for="enTexto">Palabras que se verán</label><input type="text" id="enTexto" value="${esc(sel)}" maxlength="200" placeholder="Ej. la letra completa">
      <label for="enAdj">A un adjunto de esta grabación</label><select id="enAdj"><option value="">—</option>${this.adjuntos.map(a => `<option value="${a.id}">${iconoDe(a.tipo, a.nombre)} ${esc(a.nombre)}</option>`).join('')}</select>
      <label for="enUrl">o a una página web</label><input type="url" id="enUrl" placeholder="https://…">
      <p class="nota">En el texto queda así: [palabras](adjunto) — al exportar, el enlace abre el archivo dentro del paquete.</p>
      <div class="fila"><button class="prim" id="enOk">Insertar</button><button id="enNo">Cancelar</button></div>`);
    $('enNo').onclick = () => Ventana.cerrar();
    $('enOk').onclick = () => {
      const txt = $('enTexto').value.trim().replace(/[\[\]]/g, ''), dest = $('enAdj').value ? 'adjunto:' + $('enAdj').value : $('enUrl').value.trim();
      if (!txt) return avisar('Escribe las palabras que se verán.');
      if (!dest || (!dest.startsWith('adjunto:') && !/^https?:\/\/\S+$/.test(dest))) return avisar('Elige un adjunto o escribe una dirección que empiece con https://');
      t.value = t.value.slice(0, ini) + `[${txt}](${dest})` + t.value.slice(fin);
      t.dispatchEvent(new Event('input', { bubbles: true })); Ventana.cerrar(); t.focus();
    };
  },
  /* ── Clips ── */
  async oirClip(i) {
    const c = this.reg.clips[i], donde = $('clipAudio-' + i);
    donde.innerHTML = '<p class="nota">Preparando…</p>';
    try {
      const t = await Medios.pcmTramo(this.reg, c.desde, c.hasta); if (!t) throw new Error('sin audio');
      donde.innerHTML = `<audio controls autoplay src="${URL.createObjectURL(Medios.wav(Medios.normalizar(t.pcm), t.sr, t.ch))}" style="width:100%;margin-top:6px"></audio>`;
    } catch (e) { donde.innerHTML = '<p class="nota">No se pudo: ' + esc(e.message) + '</p>'; }
  },
  clipNuevo() {
    const clips = this.reg.clips = this.reg.clips || [], ult = clips.at(-1);
    const desde = ult ? ult.hasta : 0, hasta = Math.min(this.reg.duracion, desde + 2);
    if (hasta - desde < 0.2) return avisar('No queda audio después del último clip.');
    clips.push({ n: (clips.reduce((m, x) => Math.max(m, x.n), 0)) + 1, desde, hasta, etiqueta: '', texto: '', traduccion: '', descartado: false });
    this.pintarClips(); this.guardar();
  },
  /* ── Consentimiento ── */
  firmar() {
    Ventana.abrir(`<h2>✍️ Firma de consentimiento</h2><p class="nota">Firma con el dedo. Queda como adjunto «Consentimiento».</p>
      <canvas class="firma" id="lienzo" width="900" height="360" aria-label="Espacio para firmar"></canvas>
      <input type="text" id="firmaNombre" maxlength="200" placeholder="Nombre o código de quien firma" style="margin-top:8px">
      <div class="fila"><button class="prim" id="firmaOk">Guardar firma</button><button id="firmaBorrar">Borrar</button><button id="firmaNo">Cancelar</button></div>`);
    const cv = $('lienzo'), cx = cv.getContext('2d'); let dib = false, hay = false;
    cx.lineWidth = 5; cx.lineCap = 'round'; cx.strokeStyle = '#111';
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    cv.onpointerdown = e => { dib = true; hay = true; cv.setPointerCapture(e.pointerId); cx.beginPath(); cx.moveTo(...pos(e)); };
    cv.onpointermove = e => { if (dib) { cx.lineTo(...pos(e)); cx.stroke(); } };
    cv.onpointerup = cv.onpointercancel = () => { dib = false; };
    $('firmaBorrar').onclick = () => { cx.clearRect(0, 0, cv.width, cv.height); hay = false; };
    $('firmaNo').onclick = () => Ventana.cerrar();
    $('firmaOk').onclick = () => {
      if (!hay) return avisar('Primero firma en el recuadro.');
      const quien = $('firmaNombre').value.trim();
      cx.fillStyle = '#111'; cx.font = '22px sans-serif'; cx.fillText(`${quien ? quien + ' · ' : ''}${new Date().toLocaleString('es-MX')} · ${this.reg.id}`, 12, cv.height - 14);
      cv.toBlob(async b => {
        await this.agregarAdjuntos([new File([b], `consentimiento_firma${quien ? '_' + nombreArchivo(quien, 30) : ''}.png`, { type: 'image/png' })], 'consentimiento');
        const c = this.reg.ficha.consentimiento; if (!c.forma) c.forma = 'firma'; if (c.estado === 'pendiente') c.estado = 'otorgado';
        await this.guardar(true); Ventana.cerrar(); this.pintar(); this.cargarAudio();
      }, 'image/png');
    };
  },
  async consentimientoOral() {
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return avisar('No se pudo usar el micrófono: ' + e.message); }
    const mime = formatoConsulta(), mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {}), partes = [], t0 = Date.now();
    mr.ondataavailable = e => e.data.size && partes.push(e.data); mr.start(1000);
    Ventana.abrir(`<h2>🎙️ Consentimiento oral</h2><p class="nota">Pide a la persona que diga su nombre (o código), la fecha y para qué usos da su permiso.</p>
      <div id="tiempoCons" style="font-size:34px;text-align:center;font-variant-numeric:tabular-nums">00:00:00</div>
      <div class="fila"><button class="prim" id="consFin">⏹ Terminar y guardar</button><button id="consNo">Cancelar</button></div>`, () => { if (mr.state !== 'inactive') mr.stop(); stream.getTracks().forEach(x => x.stop()); clearInterval(iv); });
    const iv = setInterval(() => $('tiempoCons') && ($('tiempoCons').textContent = reloj((Date.now() - t0) / 1000)), 500);
    $('consNo').onclick = () => { partes.length = 0; Ventana.cerrar(); };
    $('consFin').onclick = () => {
      mr.onstop = async () => {
        stream.getTracks().forEach(x => x.stop()); clearInterval(iv);
        if (!partes.length) return;
        const tipo = (mime || 'audio/webm').split(';')[0];
        await this.agregarAdjuntos([new File(partes, `consentimiento_oral_${sello(new Date())}.${extensionDe(tipo)}`, { type: tipo })], 'consentimiento');
        const c = this.reg.ficha.consentimiento; if (!c.forma) c.forma = 'oral'; if (c.estado === 'pendiente') c.estado = 'otorgado';
        await this.guardar(true); this.pintar(); this.cargarAudio();
      };
      mr.stop(); const v = $('velo'); if (v) v.remove();
    };
  },
  async borrar() {
    const f = this.reg.ficha;
    if (!confirm(`¿Borrar «${f.titulo}» de este aparato, con su audio y sus adjuntos?${!this.reg.respaldo ? '\n\n⚠️ Esta grabación NO tiene respaldo.' : ''}`)) return;
    if (!this.reg.respaldo && prompt('Para confirmar, escribe BORRAR') !== 'BORRAR') return;
    await DB.borrarGrabacion(this.reg.id); Acervo.sel.delete(this.reg.id); avisar('🗑 Borrada.'); Nav.ir('vAcervo');
  }
};

/* Eventos de la ficha (delegados) */
$('vFicha').addEventListener('input', e => {
  const x = e.target, f = Ficha.reg && Ficha.reg.ficha; if (!f) return;
  if (x.dataset.c) { Ficha.poner(x.dataset.c, x.value); if (x.tagName === 'TEXTAREA') Ficha.vistas(); return; }
  if (x.dataset.rep) { f[x.dataset.rep][x.dataset.i][x.dataset.k] = x.value; Ficha.guardar(); if (x.tagName === 'TEXTAREA') Ficha.vistas(); return; }
  if (x.dataset.clip && x.type !== 'checkbox') {
    const c = Ficha.reg.clips[x.dataset.clip], k = x.dataset.k;
    if (k === 'desde' || k === 'hasta') { const v = parseFloat(x.value.replace(',', '.')); if (!isNaN(v) && v >= 0 && v <= Ficha.reg.duracion) c[k] = v; } else c[k] = x.value;
    Ficha.guardar(); return;
  }
  if (x.dataset.adjk) { const a = Ficha.adjuntos.find(y => y.id === x.dataset.id); a[x.dataset.adjk] = x.value; DB.poner('adjuntos', a); Ficha.reg.modificada = Date.now(); Ficha.guardar(); }
});
$('vFicha').addEventListener('change', e => {
  const x = e.target;
  if (x.dataset.clip && x.type === 'checkbox') { Ficha.reg.clips[x.dataset.clip].descartado = x.checked; x.closest('.clip').classList.toggle('descartado', x.checked); Ficha.guardar(); }
  if (x.dataset.c && x.tagName === 'SELECT') Ficha.poner(x.dataset.c, x.value);
  if (x.dataset.adjk === 'papel') { const a = Ficha.adjuntos.find(y => y.id === x.dataset.id); a.papel = x.value; DB.poner('adjuntos', a); Ficha.reg.modificada = Date.now(); Ficha.guardar(); }
  if (x.id === 'fileAdj' && x.files.length) { Ficha.agregarAdjuntos([...x.files], x.dataset.papel); x.value = ''; }
});
$('vFicha').addEventListener('click', e => {
  const b = e.target.closest('[data-agregar],[data-quitar],[data-enlazar],[data-adj],[data-quitaradj],[data-adjuntar],[data-oirclip],[data-quitarclip]'); if (!b) return;
  const f = Ficha.reg.ficha;
  if (b.dataset.agregar) { const nuevo = { participantes: { nombre: '', rol: '', nota: '' }, traducciones: { lengua: '', autor: '', texto: '' }, fuentes: { titulo: '', enlace: '' } }[b.dataset.agregar]; (f[b.dataset.agregar] = f[b.dataset.agregar] || []).push(nuevo); Ficha.pintarRep(); Ficha.guardar(); }
  if (b.dataset.quitar) { f[b.dataset.quitar].splice(Number(b.dataset.i), 1); Ficha.pintarRep(); Ficha.guardar(); }
  if (b.dataset.enlazar) Ficha.enlazar(b.dataset.enlazar);
  if (b.dataset.adj) { e.preventDefault(); Ficha.abrirAdjunto(b.dataset.adj); }
  if (b.dataset.quitaradj) Ficha.quitarAdjunto(b.dataset.quitaradj);
  if (b.dataset.adjuntar !== undefined) { const inp = $('fileAdj'); inp.dataset.papel = b.dataset.adjuntar; inp.accept = b.dataset.camara ? 'image/*' : ''; b.dataset.camara ? inp.setAttribute('capture', 'environment') : inp.removeAttribute('capture'); inp.click(); }
  if (b.dataset.oirclip) Ficha.oirClip(Number(b.dataset.oirclip));
  if (b.dataset.quitarclip && confirm('¿Quitar este clip? El audio de la grabación no cambia.')) { Ficha.reg.clips.splice(Number(b.dataset.quitarclip), 1); Ficha.pintarClips(); Ficha.guardar(); }
});
