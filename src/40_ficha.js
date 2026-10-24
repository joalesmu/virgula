/* ═════════════════ FICHA: todo lo que acompaña a una grabación ═════════════════ */
const PAPELES = { foto: N_('📷 Foto'), transcripcion: N_('✍️ Transcripción o traducción'), letra: N_('🎵 Letra, acordes o partitura'), apoyo: N_('📚 Material de apoyo'), consentimiento: N_('🤝 Consentimiento'), otro: N_('📎 Otro') };
const USOS = { '': N_('— Sin especificar —'), lengua: N_('Lengua'), patrimonio: N_('Patrimonio y celebraciones'), bitacora: N_('Bitácora de campo'), naturaleza: N_('Sonidos de la naturaleza'), entrevista: N_('Entrevista o sesión de investigación'), otro: N_('Otro') };
const ROLES = [N_('Hablante'), N_('Cantante'), N_('Músico'), N_('Intérprete'), N_('Traductor'), N_('Entrevistador'), N_('Investigador'), N_('Narrador'), N_('Otro')];
const FORMAS_CONS = { '': N_('— Cómo se dio —'), oral: N_('Oral (grabado)'), firma: N_('Firma en la pantalla'), documento: N_('Documento firmado'), verbal: N_('De palabra, sin registro'), comunidad: N_('Acuerdo comunitario'), otro: N_('Otro') };
const ESTADOS_CONS = { pendiente: N_('⏳ Pendiente'), otorgado: N_('✔ Otorgado'), 'no aplica': N_('No aplica') };
const iconoDe = (tipo, nombre) => /^image\//.test(tipo) ? '🖼️' : /^audio\//.test(tipo) ? '🔊' : /^video\//.test(tipo) ? '🎞️' : /pdf/.test(tipo) || /\.pdf$/i.test(nombre) ? '📕'
  : /word|\.docx?$|opendocument\.text|\.odt$/i.test(tipo + nombre) ? '📘' : /sheet|excel|\.xlsx?$|\.ods$|\.csv$/i.test(tipo + nombre) ? '📗' : /presentation|powerpoint|\.pptx?$|\.odp$/i.test(tipo + nombre) ? '📙'
  : /^text\//.test(tipo) ? '📄' : /zip|compressed/.test(tipo) ? '🗜️' : '📎';

/** Texto con enlaces: [palabras](adjunto:ID) o [palabras](https://…). Solo eso, más saltos de línea. */
const RE_ENLACE = /\[([^\]\n]{1,200})\]\((adjunto:[\w-]+|https?:\/\/[^\s)]+)\)/g;
function textoConEnlaces(s, adjuntos, rutaAdj) {
  return esc(s).replace(/\[([^\]\n]{1,200})\]\((adjunto:[\w-]+|https?:\/\/[^\s)]+)\)/g, (m, txt, dest) => {
    if (dest.startsWith('adjunto:')) {
      const a = adjuntos.find(x => x.id === dest.slice(8));
      if (!a) return `${txt} <span class="chip mal">${tH('adjunto no disponible')}</span>`;
      return rutaAdj ? `<a href="${esc(rutaAdj(a))}">${txt}</a>` : `<a href="#" data-adj="${a.id}">${txt}</a>`;
    }
    return `<a href="${dest}" target="_blank" rel="noopener">${txt}</a>`;
  });
}

const Ficha = {
  reg: null, adjuntos: [],
  async abrir(id) {
    const reg = await DB.leer('grabaciones', id); if (!reg) return avisar(t('No se encontró la grabación.'));
    const f = reg.ficha; f.extra = f.extra || {}; f.extraEtiquetas = f.extraEtiquetas || {};
    if (!f.plantilla) f.plantilla = Plantillas.referencia(Plantillas.de('general'));
    this.reg = reg; this.adjuntos = await DB.porGrabacion('adjuntos', id);
    Nav.ir('vFicha'); this.pintar(); this.cargarAudio();
  },
  guardar(inmediato) {
    clearTimeout(this._t);
    const f = async () => {
      this.reg.modificada = Date.now(); this.reg.ficha.plantilla = Plantillas.referencia(this.plantilla());
      await DB.poner('grabaciones', this.reg); $('fGuardado') && ($('fGuardado').textContent = t('💾 Guardado {hora}', { hora: horaBonita(Date.now()) })); this.pintarFaltan();
    };
    if (inmediato) return f(); this._t = setTimeout(f, 500);
  },
  plantilla() { return Plantillas.de(this.reg.ficha.plantilla && this.reg.ficha.plantilla.id); },
  campoTexto(id, etiqueta, valor, { largo, max = 4000, ph = '', enlaces, dato = 'c' } = {}) {
    return `<label for="${id}">${etiqueta}</label>` + (largo
      ? `<textarea id="${id}" data-${dato}="${dato === 'x' ? id.slice(3) : id}" maxlength="${max}" placeholder="${esc(ph)}">${esc(valor)}</textarea>${enlaces ? `<div class="fila fija"><button class="chico" data-enlazar="${id}">${tH('🔗 Enlazar a un adjunto o página')}</button></div><div class="vista-texto oculto" id="vista-${id}"></div>` : ''}`
      : `<input type="text" id="${id}" data-${dato}="${dato === 'x' ? id.slice(3) : id}" maxlength="${max}" value="${esc(valor)}" placeholder="${esc(ph)}">`);
  },
  /** Un campo de la parte principal de la ficha, según la plantilla. */
  campoHtml(c) {
    const f = this.reg.ficha, et = esc(c.etiqueta) + (c.obligatorio ? ' <span class="oblig">*</span>' : ''), ay = c.ayuda ? `<p class="nota">${esc(c.ayuda)}</p>` : '';
    if (c.base) switch (c.id) {
      case 'titulo': return this.campoTexto('titulo', et, f.titulo, { max: 200 }) + ay;
      case 'descripcion': return this.campoTexto('descripcion', et, f.descripcion, { largo: true, max: 20000, enlaces: true, ph: t('Qué se grabó, en qué contexto, quiénes participan…') }) + ay;
      case 'notas': return this.campoTexto('notas', et, f.notas, { largo: true, max: 20000, enlaces: true }) + ay;
      case 'fechaHora': return `<label for="fechaHora">${et}</label><input type="datetime-local" id="fechaHora" data-c="fechaHora" value="${esc((f.fechaHora || '').slice(0, 16))}">` + ay;
      case 'uso': return `<label for="uso">${et}</label><select id="uso" data-c="uso">${Object.entries(USOS).map(([k, n]) => `<option value="${k}" ${k === (f.uso || '') ? 'selected' : ''}>${tH(n)}</option>`).join('')}</select>` + ay;
      case 'lugar': return this.campoTexto('lugar', et, f.lugar, { max: 300 }) + ay;
      case 'lenguas': return this.campoTexto('lenguas', et, f.lenguas, { max: 300, ph: t('Ej. wixárika (variante de San Andrés)') }) + ay;
      case 'claves': return this.campoTexto('claves', et, f.claves, { max: 500, ph: t('Separadas por comas') }) + ay;
      case 'quien': return this.campoTexto('quien', et, f.quien, { max: 200 }) + ay;
      case 'derechos': return this.campoTexto('derechos', et, f.derechos, { max: 500 }) + ay;
      case 'ubicacion': return `<label>${et}</label>${ay}<div id="fUbic"></div>`;
      case 'participantes': return `<label>${et}</label>${ay}<div id="fPart"></div><div class="fila fija"><button class="chico" data-agregar="participantes">${tH('＋ Participante')}</button></div>`;
      case 'confidencial': return `<div class="op" style="margin-top:10px"><label><input type="checkbox" id="confidencial" ${f.confidencial ? 'checked' : ''}> 🔒 ${esc(c.etiqueta)}</label></div>${ay || `<p class="nota">${tH('Confidencial: sin ubicación, participantes solo con código y un aviso antes de exportar.')}</p>`}`;
      default: return '';
    }
    return this.campoPropio(c.id, et, c, f.extra[c.id]) + ay;
  },
  campoPropio(id, et, c, v) {
    const dom = 'cx_' + id;
    switch (c.tipo) {
      case 'largo': return this.campoTexto(dom, et, v || '', { largo: true, max: 20000, enlaces: true, dato: 'x' });
      case 'numero': return `<label for="${dom}">${et}</label><input type="text" inputmode="decimal" id="${dom}" data-x="${id}" value="${esc(v == null ? '' : v)}" maxlength="40">`;
      case 'fecha': return `<label for="${dom}">${et}</label><input type="date" id="${dom}" data-x="${id}" value="${esc(v || '')}">`;
      case 'opcion': { const ops = (c.opciones || []).slice(); if (v && !ops.includes(v)) ops.push(v);
        return `<label for="${dom}">${et}</label><select id="${dom}" data-x="${id}"><option value="">—</option>${ops.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(t(o))}</option>`).join('')}</select>`; }
      case 'varias': { const sel = Array.isArray(v) ? v : [], ops = (c.opciones || []).concat(sel.filter(x => !(c.opciones || []).includes(x)));
        return `<label>${et}</label><div class="op">${ops.map(o => `<label><input type="checkbox" data-x="${id}" data-varias="1" value="${esc(o)}" ${sel.includes(o) ? 'checked' : ''}> ${esc(t(o))}</label>`).join('')}</div>`; }
      case 'sino': return `<div class="op" style="margin-top:10px"><label><input type="checkbox" data-x="${id}" data-sino="1" ${v ? 'checked' : ''}> ${et}</label></div>`;
      default: return this.campoTexto(dom, et, v || '', { max: 1000, dato: 'x' });
    }
  },
  pintarFaltan() {
    const d = $('fFaltan'); if (!d) return;
    const l = Plantillas.faltan(this.reg);
    d.innerHTML = l.length ? `<div class="banda aviso">${tH('📝 Falta: {lista}', { lista: l.join(', ') })}</div>` : `<div class="banda ok">${tH('✅ Ficha completa')}</div>`;
  },
  pintar() {
    const r = this.reg, f = r.ficha, tec = r.tecnica, c = f.consentimiento, p = this.plantilla(), campos = Plantillas.campos(p);
    const tiene = { transcripcion: !!(f.transcripcion.texto || f.transcripcion.lengua), traducciones: !!(f.traducciones || []).length, clips: !!(r.clips || []).length, fuentes: !!(f.fuentes || []).length };
    const ver = k => p.secciones[k] !== false || tiene[k];
    const mostrar = cp => cp.visible || (CAMPOS_BASE[cp.id] && CAMPOS_BASE[cp.id].nucleo) || (cp.id === 'confidencial' ? f.confidencial : !Plantillas.vacio(Plantillas.valor(f, cp)) && cp.id !== 'confidencial');
    const conocidos = new Set(campos.filter(x => !x.base).map(x => x.id)), huerfanos = Object.keys(f.extra).filter(k => !conocidos.has(k) && !Plantillas.vacio(f.extra[k]));
    $('vFicha').innerHTML = `
      <div class="fila fija"><button class="chico" id="fVolver">← ${tH('Acervo')}</button><span class="nota" id="fGuardado"></span></div>
      <div class="panel">
        <h2>${esc(f.titulo)}</h2>
        <div class="nota">${r.id} · ${fechaBonita(r.creada)} · ${reloj(r.duracion)}</div>
        <div>${tec.conArchivo ? chip(tH('🗄️ archivo WAV')) : ''}${tec.mime ? chip(tH('🔊 consulta')) : ''}${chip(tec.canales === 2 ? tH('estéreo') : tH('mono'))}${chip(tec.sr + ' Hz')}
          ${(r.silencios || []).length ? chip(tH('🔇 {n} tramo(s) sin audio', { n: r.silencios.length }), 'aviso') : ''}${r.huecos > 0.6 ? chip(tH('⚠️ huecos {s} s', { s: r.huecos.toFixed(1) }), 'mal') : ''}${r.recuperada ? chip(tH('🛟 recuperada'), 'aviso') : ''}</div>
        <div id="fAudios"><p class="nota">${tH('Cargando audio…')}</p></div>
      </div>
      <div id="fFaltan"></div>

      <details class="sec" open><summary>🧾 ${tH('Ficha')}</summary>
        <label for="fPlantilla">🧩 ${tH('Plantilla')}</label>
        <select id="fPlantilla">${Plantillas.lista.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(Plantillas.nombre(x))}</option>`).join('')}</select>
        ${campos.filter(mostrar).map(cp => this.campoHtml(cp)).join('\n')}
        ${huerfanos.length ? `<h3>${tH('Otros datos')}</h3><p class="nota">${tH('De otra plantilla o de un campo que ya no está en esta. Se conservan y se exportan.')}</p>${huerfanos.map(k => this.campoPropio(k, esc(f.extraEtiquetas[k] || k), { tipo: Array.isArray(f.extra[k]) ? 'varias' : typeof f.extra[k] === 'boolean' ? 'sino' : String(f.extra[k]).length > 120 ? 'largo' : 'texto', opciones: [] }, f.extra[k])).join('')}` : ''}
      </details>

      ${ver('transcripcion') || ver('traducciones') ? `<details class="sec" ${tiene.transcripcion || tiene.traducciones ? 'open' : ''}><summary>✍️ ${ver('transcripcion') && ver('traducciones') ? tH('Transcripción y traducciones') : ver('transcripcion') ? tH('Transcripción') : tH('Traducciones')}</summary>
        ${ver('transcripcion') ? `<div class="fila"><div><label for="transLengua">${tH('Lengua de la transcripción')}</label><input type="text" id="transLengua" data-c="transcripcion.lengua" value="${esc(f.transcripcion.lengua)}" maxlength="120"></div></div>
        ${this.campoTexto('transTexto', tH('Transcripción (lo que se dice, escrito en su lengua)'), f.transcripcion.texto, { largo: true, max: 100000, enlaces: true })}` : ''}
        ${ver('traducciones') ? `<h3>${tH('Traducciones')}</h3><div id="fTrad"></div>
        <div class="fila fija"><button class="chico" data-agregar="traducciones">${tH('＋ Traducción')}</button></div>` : ''}
      </details>` : ''}

      ${ver('clips') ? `<details class="sec" ${tiene.clips ? 'open' : ''}><summary>🔖 ${tH('Clips')} (${(r.clips || []).filter(x => !x.descartado).length})</summary>
        <p class="nota">${tH('Cada marca cortó un clip. Escribe su etiqueta (por ejemplo, la palabra que se dijo): al exportar, cada clip sale con ese nombre, listo para traerlo al catálogo de lenguas.')}</p>
        <div id="fClips"></div>
        <div class="fila fija"><button class="chico" id="bClipNuevo">${tH('＋ Clip a mano')}</button></div>
      </details>` : ''}

      ${ver('fuentes') ? `<details class="sec" ${tiene.fuentes ? 'open' : ''}><summary>📚 ${tH('Fuentes y enlaces')}</summary>
        <div id="fFuentes"></div>
        <div class="fila fija"><button class="chico" data-agregar="fuentes">${tH('＋ Fuente')}</button></div>
      </details>` : ''}

      <details class="sec" open><summary>🤝 ${tH('Consentimiento')} <span class="oblig">*</span></summary>
        <div class="op" role="radiogroup">${['pendiente', 'otorgado', 'no aplica'].map(v => `<label><input type="radio" name="consEstado" value="${v}" ${c.estado === v ? 'checked' : ''}> ${tH(ESTADOS_CONS[v])}</label>`).join('')}</div>
        <p class="nota">${tH('«No aplica» sirve, por ejemplo, para sonidos de la naturaleza o espacios públicos sin personas identificables.')}</p>
        <div class="fila"><div><label for="consForma">${tH('Cómo se dio')}</label><select id="consForma" data-c="consentimiento.forma">${Object.entries(FORMAS_CONS).map(([k, n]) => `<option value="${k}" ${k === c.forma ? 'selected' : ''}>${tH(n)}</option>`).join('')}</select></div></div>
        ${this.campoTexto('consNota', tH('Condiciones o notas (qué usos se aceptaron, quién lo dio…)'), c.nota, { largo: true, max: 4000 })}
        <div class="fila"><button class="chico" id="bFirma">${tH('✍️ Firmar con el dedo')}</button><button class="chico" id="bConsOral">${tH('🎙️ Grabar consentimiento')}</button><button class="chico" data-adjuntar="consentimiento">${tH('📄 Adjuntar documento')}</button></div>
      </details>

      <details class="sec" open><summary>📎 ${tH('Adjuntos')} (<span id="nAdj">${this.adjuntos.length}</span>)</summary>
        <p class="nota">${tH('Fotos, documentos, letras, materiales… de cualquier tipo. Se guarda una copia dentro de Vírgula.')}</p>
        <div id="fAdj"></div>
        <div class="fila"><button data-adjuntar="">${tH('📎 Adjuntar archivo')}</button><button data-adjuntar="foto" data-camara="1">${tH('📷 Tomar foto')}</button></div>
        <input type="file" id="fileAdj" multiple class="oculto">
      </details>

      <details class="sec"><summary>⚙️ ${tH('Datos técnicos y eventos')}</summary>
        <pre>${esc(this.tecnicaTexto())}</pre>
      </details>

      <div class="fila"><button class="prim" id="bExportarUna">${tH('📦 Exportar esta grabación')}</button><button class="peligro" id="bBorrar">${tH('🗑 Borrar')}</button></div>`;
    this.pintarUbic(); this.pintarRep(); this.pintarClips(); this.pintarAdj(); this.vistas(); this.pintarFaltan();
    $('fVolver').onclick = () => Nav.ir('vAcervo');
    $('bExportarUna').onclick = () => Exportar.abrir([r.id]);
    $('bBorrar').onclick = () => this.borrar();
    if ($('bClipNuevo')) $('bClipNuevo').onclick = () => this.clipNuevo();
    $('bFirma').onclick = () => this.firmar();
    $('bConsOral').onclick = () => this.consentimientoOral();
    $('fPlantilla').onchange = e => { Plantillas.aplicarPredet(f, Plantillas.de(e.target.value)); this.guardar(true); this.pintar(); this.cargarAudio(); };
    if ($('confidencial')) $('confidencial').onchange = e => { f.confidencial = e.target.checked; if (f.confidencial && f.ubicacion) { f.ubicacion = null; avisar(t('🔒 Se quitó la ubicación.')); } this.pintarUbic(); this.pintarRep(); this.guardar(); };
    document.querySelectorAll('input[name="consEstado"]').forEach(x => x.onchange = () => { c.estado = x.value; this.guardar(); });
  },
  tecnicaTexto() {
    const r = this.reg, tec = r.tecnica, sn = b => b ? t('sí') : t('no');
    return [t('Código: {x}', { x: r.id }), t('Duración: {x}', { x: `${reloj(r.duracion)} (${(r.duracion || 0).toFixed(1)} s)` }),
      t('Archivo WAV: {x}', { x: tec.conArchivo ? t('sí, {sr} Hz, 16 bits, {ch} canal(es)', { sr: tec.sr, ch: tec.canales }) : t('no') }) + ' · ' + t('Consulta: {x}', { x: tec.mime || t('no') }) + (tec.ganancia ? ' ' + t('(volumen de consulta ×{g})', { g: tec.ganancia }) : ''),
      t('Ajustes pedidos: volumen automático {a}, quitar ruido {b}, quitar eco {c}', { a: sn(tec.ajustesPedidos.volAuto), b: sn(tec.ajustesPedidos.ruido), c: sn(tec.ajustesPedidos.eco) }),
      t('Ajustes reales del micrófono: {x}', { x: JSON.stringify(tec.ajustesReales) }), t('Micrófono: {x}', { x: tec.microfono }), t('Aparato: {x}', { x: tec.aparato }), t('Versión de Vírgula: {x}', { x: r.version }),
      t('Saturaciones: {a} · Huecos: {b} s · Tramos sin audio: {c}', { a: r.saturaciones || 0, b: (r.huecos || 0).toFixed(1), c: (r.silencios || []).map(s => relojFino(s.desde) + '–' + relojFino(s.hasta)).join(', ') || t('ninguno') }),
      '', t('Eventos:'), ...(r.eventos || []).map(e => `  ${relojFino(e.t)} (${e.hora}) ${e.tipo}${e.detalle ? ' — ' + e.detalle : ''}`)].join('\n');
  },
  async cargarAudio() {
    try {
      const a = await Medios.archivos(this.reg), url = f => URL.createObjectURL(f);
      $('fAudios').innerHTML = [a.consulta ? `<p class="nota" style="margin-top:8px">🔊 ${tH('Consulta')} · ${mb(a.consulta.size)}</p><audio controls preload="metadata" src="${url(a.consulta)}" style="width:100%"></audio>` : '',
        a.wav ? `<p class="nota" style="margin-top:8px">🗄️ ${tH('Archivo (WAV, sin alterar)')} · ${mb(a.wav.size)}</p><audio controls preload="none" src="${url(a.wav)}" style="width:100%"></audio>` : ''].join('') || `<p class="nota">${tH('Sin audio guardado.')}</p>`;
    } catch (e) { $('fAudios').innerHTML = `<p class="nota">${tH('No se pudo leer el audio: {error}', { error: e.message })}</p>`; }
  },
  pintarUbic() {
    if (!$('fUbic')) return;
    const f = this.reg.ficha, u = f.ubicacion, modos = { exacta: t('exacta'), aprox1: t('aproximada (~1 km)'), aprox10: t('aproximada (~10 km)') };
    $('fUbic').innerHTML = f.confidencial ? `<p class="nota">${tH('🔒 Confidencial: sin ubicación.')}</p>` : u
      ? `<p class="nota">📍 ${u.lat}, ${u.lon} · ${esc(modos[u.modo] || u.modo)}${u.precisionM ? ' · ' + tH('precisión del aparato ±{m} m', { m: Math.round(u.precisionM) }) : ''} · <a href="https://www.openstreetmap.org/?mlat=${u.lat}&mlon=${u.lon}#map=${u.modo === 'exacta' ? 16 : u.modo === 'aprox1' ? 13 : 10}/${u.lat}/${u.lon}" target="_blank" rel="noopener">${tH('ver mapa')}</a></p><div class="fila fija"><button class="chico" id="bUbic">${tH('📍 Volver a tomar')}</button><button class="chico" id="bUbicQuitar">${tH('✕ Quitar ubicación')}</button></div>`
      : `<div class="fila fija"><button class="chico" id="bUbic">${tH('📍 Agregar ubicación')}</button><select id="ubicModo" style="width:auto" aria-label="${tH('Precisión')}">${Object.entries(modos).map(([k, n]) => `<option value="${k}" ${k === Ajustes.v.ubic ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>`;
    if ($('bUbic')) $('bUbic').onclick = () => this.ubicar(u ? u.modo : $('ubicModo').value);
    if ($('bUbicQuitar')) $('bUbicQuitar').onclick = () => { f.ubicacion = null; this.pintarUbic(); this.guardar(); };
  },
  ubicar(modo) {
    if (!navigator.geolocation) return avisar(t('Este aparato no da la ubicación.'));
    avisar(t('📍 Buscando ubicación… puede tardar al aire libre.'), 4000);
    navigator.geolocation.getCurrentPosition(p => {
      const dec = modo === 'exacta' ? 6 : modo === 'aprox1' ? 2 : 1, red = x => Number(x.toFixed(dec));
      this.reg.ficha.ubicacion = { lat: red(p.coords.latitude), lon: red(p.coords.longitude), precisionM: modo === 'exacta' ? p.coords.accuracy : null, altitud: modo === 'exacta' && p.coords.altitude != null ? Math.round(p.coords.altitude) : null, modo, fecha: Date.now() };
      this.pintarUbic(); this.guardar(); avisar(t('📍 Ubicación guardada.'));
    }, e => avisar(t('No se pudo obtener la ubicación: {error}', { error: e.message }), 5000), { enableHighAccuracy: modo === 'exacta', timeout: 30000, maximumAge: 60000 });
  },
  pintarRep() {
    const f = this.reg.ficha, conf = f.confidencial;
    if ($('fPart')) $('fPart').innerHTML = (f.participantes || []).map((p, i) => `<div class="rep"><div class="fila">
      <input type="text" data-rep="participantes" data-i="${i}" data-k="nombre" value="${esc(p.nombre)}" maxlength="200" placeholder="${conf ? tH('Código (p. ej. P01)') : tH('Nombre o código')}" aria-label="${tH('Nombre')}">
      <input type="text" data-rep="participantes" data-i="${i}" data-k="rol" value="${esc(p.rol)}" list="dlRoles" placeholder="${tH('Rol')}" aria-label="${tH('Rol')}" style="max-width:180px">
      <button class="chico" data-quitar="participantes" data-i="${i}" aria-label="${tH('Quitar')}">✕</button></div>
      ${conf ? '' : `<input type="text" data-rep="participantes" data-i="${i}" data-k="nota" value="${esc(p.nota || '')}" maxlength="300" placeholder="${tH('Comunidad, edad aproximada, otros datos que acepte compartir')}" style="margin-top:6px">`}</div>`).join('')
      + `<datalist id="dlRoles">${ROLES.map(x => `<option value="${tH(x)}">`).join('')}</datalist>`;
    if ($('fTrad')) $('fTrad').innerHTML = (f.traducciones || []).map((x, i) => `<div class="rep"><div class="fila">
      <input type="text" data-rep="traducciones" data-i="${i}" data-k="lengua" value="${esc(x.lengua)}" maxlength="120" placeholder="${tH('Lengua')}" aria-label="${tH('Lengua')}">
      <input type="text" data-rep="traducciones" data-i="${i}" data-k="autor" value="${esc(x.autor)}" maxlength="200" placeholder="${tH('Quién tradujo')}" aria-label="${tH('Quién tradujo')}">
      <button class="chico" data-quitar="traducciones" data-i="${i}" aria-label="${tH('Quitar')}">✕</button></div>
      <textarea data-rep="traducciones" data-i="${i}" data-k="texto" id="trad-${i}" maxlength="100000" placeholder="${tH('Traducción')}" style="margin-top:6px">${esc(x.texto)}</textarea>
      <div class="fila fija"><button class="chico" data-enlazar="trad-${i}">${tH('🔗 Enlazar')}</button></div><div class="vista-texto oculto" id="vista-trad-${i}"></div></div>`).join('');
    if ($('fFuentes')) $('fFuentes').innerHTML = (f.fuentes || []).map((s, i) => `<div class="rep"><div class="fila">
      <input type="text" data-rep="fuentes" data-i="${i}" data-k="titulo" value="${esc(s.titulo)}" maxlength="300" placeholder="${tH('Título o referencia')}" aria-label="${tH('Título')}">
      <button class="chico" data-quitar="fuentes" data-i="${i}" aria-label="${tH('Quitar')}">✕</button></div>
      <input type="url" data-rep="fuentes" data-i="${i}" data-k="enlace" value="${esc(s.enlace)}" maxlength="1000" placeholder="${tH('https://… (opcional)')}" style="margin-top:6px"></div>`).join('');
    this.vistas();
  },
  pintarClips() {
    const clips = this.reg.clips || []; if (!$('fClips')) return;
    $('fClips').innerHTML = clips.length ? clips.map((c, i) => `<div class="clip ${c.descartado ? 'descartado' : ''}">
      <div class="fila fija"><b>#${c.n}</b><span class="t">${relojFino(c.desde)} → ${relojFino(c.hasta)} · ${(c.hasta - c.desde).toFixed(1)} s</span>
        <button class="chico" data-oirclip="${i}">${tH('▶ Oír')}</button>
        <label style="margin:0;display:flex;gap:6px;align-items:center;color:var(--texto)"><input type="checkbox" data-clip="${i}" data-k="descartado" ${c.descartado ? 'checked' : ''}> ${tH('descartado')}</label></div>
      <div class="fila"><input type="text" data-clip="${i}" data-k="etiqueta" value="${esc(c.etiqueta)}" maxlength="120" placeholder="${tH('Etiqueta (p. ej. la palabra)')}" aria-label="${tH('Etiqueta del clip {n}', { n: c.n })}">
        <input type="text" data-clip="${i}" data-k="traduccion" value="${esc(c.traduccion)}" maxlength="300" placeholder="${tH('Traducción (opcional)')}" aria-label="${tH('Traducción')}"></div>
      <details style="margin-top:4px"><summary class="nota">${tH('Ajustar o anotar')}</summary>
        <div class="fila"><div><label>${tH('Desde (s)')}</label><input type="text" inputmode="decimal" data-clip="${i}" data-k="desde" value="${c.desde.toFixed(2)}"></div><div><label>${tH('Hasta (s)')}</label><input type="text" inputmode="decimal" data-clip="${i}" data-k="hasta" value="${c.hasta.toFixed(2)}"></div></div>
        <input type="text" data-clip="${i}" data-k="texto" value="${esc(c.texto)}" maxlength="2000" placeholder="${tH('Transcripción o nota del clip')}" style="margin-top:6px">
        <div class="fila fija"><button class="chico" data-quitarclip="${i}">${tH('✕ Quitar clip')}</button></div></details>
      <div id="clipAudio-${i}"></div></div>`).join('') : `<p class="nota">${tH('Sin clips: esta grabación no tiene marcas. Puedes cortar clips a mano.')}</p>`;
  },
  pintarAdj() {
    $('nAdj').textContent = this.adjuntos.length;
    $('fAdj').innerHTML = this.adjuntos.length ? this.adjuntos.map(a => `<div class="adj"><span class="ico">${iconoDe(a.tipo, a.nombre)}</span>
      <div class="info"><b>${esc(a.nombre)}</b><span class="nota">${mb(a.tam)}</span>
        <select data-adjk="papel" data-id="${a.id}" style="margin-top:4px" aria-label="${tH('Papel del adjunto')}">${Object.entries(PAPELES).map(([k, n]) => `<option value="${k}" ${k === a.papel ? 'selected' : ''}>${tH(n)}</option>`).join('')}</select>
        <input type="text" data-adjk="nota" data-id="${a.id}" value="${esc(a.nota || '')}" maxlength="500" placeholder="${tH('Nota (qué es, quién lo hizo…)')}" style="margin-top:4px">
        <div class="fila fija"><button class="chico" data-adj="${a.id}">${tH('👁 Abrir')}</button><button class="chico" data-quitaradj="${a.id}">${tH('✕ Quitar')}</button></div></div></div>`).join('') : `<p class="nota">${tH('Sin adjuntos.')}</p>`;
  },
  vistas() {
    document.querySelectorAll('#vFicha textarea').forEach(ta => {
      const v = $('vista-' + ta.id); if (!v) return;
      const tiene = RE_ENLACE.test(ta.value); RE_ENLACE.lastIndex = 0;
      v.classList.toggle('oculto', !tiene); if (tiene) v.innerHTML = '🔗 ' + textoConEnlaces(ta.value, this.adjuntos);
    });
  },
  /* ── Edición ── */
  poner(ruta, valor) {
    const f = this.reg.ficha, mapa = { transLengua: 'transcripcion.lengua', transTexto: 'transcripcion.texto', consNota: 'consentimiento.nota' };
    const p = (mapa[ruta] || ruta).split('.'); let o = f; for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p.at(-1)] = ruta === 'fechaHora' ? (valor ? valor + ':00' : '') : valor;
    this.guardar();
  },
  ponerExtra(id, v) {
    const f = this.reg.ficha, c = this.plantilla().campos.find(x => x.id === id);
    if (c && c.tipo === 'numero') v = v.trim();
    f.extra[id] = v; if (c) f.extraEtiquetas[id] = c.etiqueta;
    this.guardar();
  },
  async agregarAdjuntos(archivos, papel) {
    let n = 0;
    for (const f of archivos) {
      const a = { id: 'A' + Date.now().toString(36) + azar(4), grabacion: this.reg.id, nombre: f.name || ('adjunto-' + n), tipo: f.type || '', tam: f.size,
        papel: papel || (/^image\//.test(f.type) ? 'foto' : 'otro'), nota: '', blob: f, fecha: Date.now() };
      try { await DB.poner('adjuntos', a); this.adjuntos.push(a); n++; } catch (e) { avisar(t('No se pudo guardar «{nombre}»: {error}', { nombre: f.name, error: e.message }), 5000); }
    }
    if (n) { this.reg.modificada = Date.now(); await this.guardar(true); this.pintarAdj(); avisar(t('📎 {n} adjunto(s) guardado(s).', { n })); }
  },
  abrirAdjunto(id) {
    const a = this.adjuntos.find(x => x.id === id); if (!a) return;
    const url = URL.createObjectURL(new File([a.blob], a.nombre, { type: a.tipo || 'application/octet-stream' }));
    if (/^(image|audio|video|text)\/|pdf/.test(a.tipo)) window.open(url, '_blank');
    else { const l = document.createElement('a'); l.href = url; l.download = a.nombre; document.body.appendChild(l); l.click(); l.remove(); }
  },
  async quitarAdjunto(id) {
    const a = this.adjuntos.find(x => x.id === id); if (!a || !confirm(t('¿Quitar «{nombre}» de esta grabación?', { nombre: a.nombre }))) return;
    await DB.quitar('adjuntos', id); this.adjuntos = this.adjuntos.filter(x => x.id !== id);
    this.reg.modificada = Date.now(); await this.guardar(true); this.pintarAdj(); this.vistas();
  },
  enlazar(idCampo) {
    const ta = $(idCampo); if (!ta) return;
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd), ini = ta.selectionStart, fin = ta.selectionEnd;
    Ventana.abrir(`<h2>🔗 ${tH('Enlazar')}</h2>
      <label for="enTexto">${tH('Palabras que se verán')}</label><input type="text" id="enTexto" value="${esc(sel)}" maxlength="200" placeholder="${tH('Ej. la letra completa')}">
      <label for="enAdj">${tH('A un adjunto de esta grabación')}</label><select id="enAdj"><option value="">—</option>${this.adjuntos.map(a => `<option value="${a.id}">${iconoDe(a.tipo, a.nombre)} ${esc(a.nombre)}</option>`).join('')}</select>
      <label for="enUrl">${tH('o a una página web')}</label><input type="url" id="enUrl" placeholder="https://…">
      <p class="nota">${tH('En el texto queda así: [palabras](adjunto) — al exportar, el enlace abre el archivo dentro del paquete.')}</p>
      <div class="fila"><button class="prim" id="enOk">${tH('Insertar')}</button><button id="enNo">${tH('Cancelar')}</button></div>`);
    $('enNo').onclick = () => Ventana.cerrar();
    $('enOk').onclick = () => {
      const txt = $('enTexto').value.trim().replace(/[\[\]]/g, ''), dest = $('enAdj').value ? 'adjunto:' + $('enAdj').value : $('enUrl').value.trim();
      if (!txt) return avisar(t('Escribe las palabras que se verán.'));
      if (!dest || (!dest.startsWith('adjunto:') && !/^https?:\/\/\S+$/.test(dest))) return avisar(t('Elige un adjunto o escribe una dirección que empiece con https://'));
      ta.value = ta.value.slice(0, ini) + `[${txt}](${dest})` + ta.value.slice(fin);
      ta.dispatchEvent(new Event('input', { bubbles: true })); Ventana.cerrar(); ta.focus();
    };
  },
  /* ── Clips ── */
  async oirClip(i) {
    const c = this.reg.clips[i], donde = $('clipAudio-' + i);
    donde.innerHTML = `<p class="nota">${tH('Preparando…')}</p>`;
    try {
      const tr = await Medios.pcmTramo(this.reg, c.desde, c.hasta); if (!tr) throw new Error(t('sin audio'));
      donde.innerHTML = `<audio controls autoplay src="${URL.createObjectURL(Medios.wav(Medios.normalizar(tr.pcm), tr.sr, tr.ch))}" style="width:100%;margin-top:6px"></audio>`;
    } catch (e) { donde.innerHTML = `<p class="nota">${tH('No se pudo: {error}', { error: e.message })}</p>`; }
  },
  clipNuevo() {
    const clips = this.reg.clips = this.reg.clips || [], ult = clips.at(-1);
    const desde = ult ? ult.hasta : 0, hasta = Math.min(this.reg.duracion, desde + 2);
    if (hasta - desde < 0.2) return avisar(t('No queda audio después del último clip.'));
    clips.push({ n: (clips.reduce((m, x) => Math.max(m, x.n), 0)) + 1, desde, hasta, etiqueta: '', texto: '', traduccion: '', descartado: false });
    this.pintarClips(); this.guardar();
  },
  /* ── Consentimiento ── */
  firmar() {
    Ventana.abrir(`<h2>✍️ ${tH('Firma de consentimiento')}</h2><p class="nota">${tH('Firma con el dedo. Queda como adjunto «Consentimiento».')}</p>
      <canvas class="firma" id="lienzo" width="900" height="360" aria-label="${tH('Espacio para firmar')}"></canvas>
      <input type="text" id="firmaNombre" maxlength="200" placeholder="${tH('Nombre o código de quien firma')}" style="margin-top:8px">
      <div class="fila"><button class="prim" id="firmaOk">${tH('Guardar firma')}</button><button id="firmaBorrar">${tH('Borrar')}</button><button id="firmaNo">${tH('Cancelar')}</button></div>`);
    const cv = $('lienzo'), cx = cv.getContext('2d'); let dib = false, hay = false;
    cx.lineWidth = 5; cx.lineCap = 'round'; cx.strokeStyle = '#111';
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    cv.onpointerdown = e => { dib = true; hay = true; cv.setPointerCapture(e.pointerId); cx.beginPath(); cx.moveTo(...pos(e)); };
    cv.onpointermove = e => { if (dib) { cx.lineTo(...pos(e)); cx.stroke(); } };
    cv.onpointerup = cv.onpointercancel = () => { dib = false; };
    $('firmaBorrar').onclick = () => { cx.clearRect(0, 0, cv.width, cv.height); hay = false; };
    $('firmaNo').onclick = () => Ventana.cerrar();
    $('firmaOk').onclick = () => {
      if (!hay) return avisar(t('Primero firma en el recuadro.'));
      const quien = $('firmaNombre').value.trim();
      cx.fillStyle = '#111'; cx.font = '22px sans-serif'; cx.fillText(`${quien ? quien + ' · ' : ''}${new Date().toLocaleString(Idioma.locale)} · ${this.reg.id}`, 12, cv.height - 14);
      cv.toBlob(async b => {
        await this.agregarAdjuntos([new File([b], `consentimiento_firma${quien ? '_' + nombreArchivo(quien, 30) : ''}.png`, { type: 'image/png' })], 'consentimiento');
        const c = this.reg.ficha.consentimiento; if (!c.forma) c.forma = 'firma'; if (c.estado === 'pendiente') c.estado = 'otorgado';
        await this.guardar(true); Ventana.cerrar(); this.pintar(); this.cargarAudio();
      }, 'image/png');
    };
  },
  async consentimientoOral() {
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return avisar(t('No se pudo usar el micrófono: {error}. Revisa el permiso del micrófono.', { error: e.message })); }
    const mime = formatoConsulta(), mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {}), partes = [], t0 = Date.now();
    mr.ondataavailable = e => e.data.size && partes.push(e.data); mr.start(1000);
    let iv = 0;
    Ventana.abrir(`<h2>🎙️ ${tH('Consentimiento oral')}</h2><p class="nota">${tH('Pide a la persona que diga su nombre (o código), la fecha y para qué usos da su permiso.')}</p>
      <div id="tiempoCons" style="font-size:34px;text-align:center;font-variant-numeric:tabular-nums">00:00:00</div>
      <div class="fila"><button class="prim" id="consFin">${tH('⏹ Terminar y guardar')}</button><button id="consNo">${tH('Cancelar')}</button></div>`, () => { if (mr.state !== 'inactive') mr.stop(); stream.getTracks().forEach(x => x.stop()); clearInterval(iv); });
    iv = setInterval(() => $('tiempoCons') && ($('tiempoCons').textContent = reloj((Date.now() - t0) / 1000)), 500);
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
    if (!confirm(t('¿Borrar «{titulo}» de este aparato, con su audio y sus adjuntos?', { titulo: f.titulo }) + (!this.reg.respaldo ? '\n\n' + t('⚠️ Esta grabación NO tiene respaldo.') : ''))) return;
    if (!this.reg.respaldo && prompt(t('Para confirmar, escribe BORRAR')) !== t('BORRAR')) return;
    await DB.borrarGrabacion(this.reg.id); Acervo.sel.delete(this.reg.id); avisar(t('🗑 Borrada.')); Nav.ir('vAcervo');
  }
};

/* Eventos de la ficha (delegados) */
$('vFicha').addEventListener('input', e => {
  const x = e.target, f = Ficha.reg && Ficha.reg.ficha; if (!f) return;
  if (x.dataset.c) { Ficha.poner(x.dataset.c, x.value); if (x.tagName === 'TEXTAREA') Ficha.vistas(); return; }
  if (x.dataset.x && x.type !== 'checkbox' && x.tagName !== 'SELECT') { Ficha.ponerExtra(x.dataset.x, x.value); if (x.tagName === 'TEXTAREA') Ficha.vistas(); return; }
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
  if (x.dataset.x && x.tagName === 'SELECT') Ficha.ponerExtra(x.dataset.x, x.value);
  if (x.dataset.x && x.dataset.sino) Ficha.ponerExtra(x.dataset.x, x.checked);
  if (x.dataset.x && x.dataset.varias) Ficha.ponerExtra(x.dataset.x, [...document.querySelectorAll(`#vFicha [data-x="${x.dataset.x}"][data-varias]:checked`)].map(y => y.value));
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
  if (b.dataset.quitarclip && confirm(t('¿Quitar este clip? El audio de la grabación no cambia.'))) { Ficha.reg.clips.splice(Number(b.dataset.quitarclip), 1); Ficha.pintarClips(); Ficha.guardar(); }
});
