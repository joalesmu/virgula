/* ═════════════════ PLANTILLAS DE FICHA ═════════════════
   Una plantilla decide qué campos se ven, cómo se llaman, en qué orden y cuáles son obligatorios.
   Núcleo que nunca se quita: título, fecha y hora, consentimiento.
   Los datos nunca se pierden: si un campo se oculta o se cambia la plantilla, lo escrito se conserva. */
const FORMATO_PLANTILLA = 'virgula-plantilla-1';
const CAMPOS_BASE = {
  titulo: { etiqueta: N_('Título'), nucleo: true },
  fechaHora: { etiqueta: N_('Fecha y hora'), nucleo: true },
  descripcion: { etiqueta: N_('Descripción') },
  uso: { etiqueta: N_('Uso') },
  lugar: { etiqueta: N_('Lugar (comunidad, municipio, sitio)') },
  ubicacion: { etiqueta: N_('Ubicación') },
  lenguas: { etiqueta: N_('Lengua(s) o variante(s)') },
  claves: { etiqueta: N_('Palabras clave') },
  participantes: { etiqueta: N_('Participantes') },
  quien: { etiqueta: N_('Quién grabó') },
  derechos: { etiqueta: N_('Derechos y licencia') },
  notas: { etiqueta: N_('Notas') },
  confidencial: { etiqueta: N_('Confidencial') }
};
const SECCIONES_BASE = { transcripcion: N_('✍️ Transcripción'), traducciones: N_('🌐 Traducciones'), clips: N_('🔖 Clips'), fuentes: N_('📚 Fuentes y enlaces') };
const TIPOS_CAMPO = { texto: N_('Texto corto'), largo: N_('Texto largo'), numero: N_('Número'), fecha: N_('Fecha'), opcion: N_('Una opción de una lista'), varias: N_('Varias opciones de una lista'), sino: N_('Sí / no') };
const ESTANDARES = {
  '': N_('— Ninguno —'),
  'dc:subject': N_('Dublin Core · tema (subject)'), 'dc:coverage': N_('Dublin Core · cobertura (coverage)'), 'dc:description': N_('Dublin Core · descripción'), 'dc:contributor': N_('Dublin Core · colaborador'),
  'dc:relation': N_('Dublin Core · relación'), 'dc:source': N_('Dublin Core · fuente'), 'dc:type': N_('Dublin Core · tipo'),
  'dwc:scientificName': N_('Darwin Core · nombre científico'), 'dwc:vernacularName': N_('Darwin Core · nombre común'), 'dwc:individualCount': N_('Darwin Core · número de individuos'),
  'dwc:sex': N_('Darwin Core · sexo'), 'dwc:lifeStage': N_('Darwin Core · etapa de vida'), 'dwc:behavior': N_('Darwin Core · comportamiento'), 'dwc:habitat': N_('Darwin Core · hábitat'),
  'dwc:eventRemarks': N_('Darwin Core · notas del evento'), 'dwc:occurrenceRemarks': N_('Darwin Core · notas del registro'), 'dwc:samplingProtocol': N_('Darwin Core · protocolo'),
  'dwc:identificationRemarks': N_('Darwin Core · notas de identificación'), 'dwc:identifiedBy': N_('Darwin Core · identificó')
};
const ORDEN_BASE = ['titulo', 'fechaHora', 'descripcion', 'uso', 'lugar', 'ubicacion', 'lenguas', 'claves', 'participantes', 'quien', 'derechos', 'notas', 'confidencial'];

/** Arma una plantilla a partir de cambios sobre la general. */
function plantillaFabrica(id, nombre, descripcion, o = {}) {
  const ocultos = new Set(o.ocultos || []), oblig = new Set(o.obligatorios || []), etq = o.etiquetas || {}, ayuda = o.ayudas || {};
  const campos = ORDEN_BASE.map(k => ({ id: k, base: true, etiqueta: etq[k] || '', ayuda: ayuda[k] || '', visible: !ocultos.has(k), obligatorio: CAMPOS_BASE[k].nucleo || oblig.has(k) }));
  (o.extra || []).forEach(x => { const despues = x.despues ? campos.findIndex(c => c.id === x.despues) + 1 : campos.length; campos.splice(despues, 0, Object.assign({ visible: true, obligatorio: false, ayuda: '', opciones: [], estandar: '' }, x, { despues: undefined })); });
  const secciones = {}; Object.keys(SECCIONES_BASE).forEach(k => { secciones[k] = !(o.seccionesOcultas || []).includes(k); });
  return { id, nombre, descripcion, version: 1, equipo: '', fija: false, fabrica: true, autoria: 'local', uso: o.uso || '', predet: Object.assign({ confidencial: false, consentimiento: 'pendiente' }, o.predet || {}), campos, secciones, modificada: 0 };
}
const PLANTILLAS_FABRICA = () => [
  plantillaFabrica('general', N_('General'), N_('Todos los campos, para cualquier grabación.')),
  plantillaFabrica('lengua', N_('Lengua'), N_('Vocabulario, narraciones y conversaciones en lengua, con transcripción, traducciones y clips para el catálogo.'), {
    uso: 'lengua', obligatorios: ['lenguas'],
    ayudas: { lenguas: N_('Lengua y variante; por ejemplo, wixárika de San Andrés Cohamiata.') },
    extra: [{ id: 'x_genero', etiqueta: N_('Tipo de habla'), tipo: 'opcion', opciones: [N_('Vocabulario o palabras sueltas'), N_('Frases'), N_('Narración'), N_('Conversación'), N_('Canto'), N_('Discurso o ceremonia'), N_('Otro')], despues: 'lenguas', estandar: 'dc:type' }]
  }),
  plantillaFabrica('patrimonio', N_('Patrimonio y celebraciones'), N_('Música, rituales, fiestas y saberes, con sus restricciones de uso.'), {
    uso: 'patrimonio',
    extra: [
      { id: 'x_evento', etiqueta: N_('Celebración, ritual o evento'), tipo: 'texto', despues: 'descripcion', estandar: 'dc:subject' },
      { id: 'x_ocasion', etiqueta: N_('Ocasión o calendario'), tipo: 'texto', despues: 'x_evento' },
      { id: 'x_instrumentos', etiqueta: N_('Instrumentos'), tipo: 'texto', despues: 'x_ocasion' },
      { id: 'x_restricciones', etiqueta: N_('Restricciones de uso o difusión'), tipo: 'largo', despues: 'derechos', ayuda: N_('Lo que la comunidad pide: qué no se debe publicar, quién puede escucharlo, en qué fechas…') }
    ]
  }),
  plantillaFabrica('bitacora', N_('Bitácora de campo'), N_('Notas habladas del día de trabajo: actividades, observaciones y pendientes.'), {
    uso: 'bitacora', seccionesOcultas: ['traducciones'], ocultos: ['participantes', 'lenguas'], predet: { consentimiento: 'no aplica' },
    extra: [
      { id: 'x_actividad', etiqueta: N_('Actividades del día'), tipo: 'largo', despues: 'descripcion' },
      { id: 'x_pendientes', etiqueta: N_('Pendientes'), tipo: 'largo', despues: 'x_actividad' }
    ]
  }),
  plantillaFabrica('naturaleza', N_('Sonidos de la naturaleza'), N_('Aves, ranas, insectos, paisajes sonoros. Exporta también en Darwin Core para bases de biodiversidad.'), {
    uso: 'naturaleza', seccionesOcultas: ['transcripcion', 'traducciones'], ocultos: ['participantes', 'lenguas'], obligatorios: ['ubicacion'], predet: { consentimiento: 'no aplica' },
    etiquetas: { descripcion: N_('Qué se escucha') },
    extra: [
      { id: 'x_especie', etiqueta: N_('Nombre científico'), tipo: 'texto', despues: 'descripcion', estandar: 'dwc:scientificName', ayuda: N_('Si no estás seguro, déjalo vacío o escribe solo el género.') },
      { id: 'x_comun', etiqueta: N_('Nombre común'), tipo: 'texto', despues: 'x_especie', estandar: 'dwc:vernacularName' },
      { id: 'x_local', etiqueta: N_('Nombre en la lengua local'), tipo: 'texto', despues: 'x_comun', estandar: 'dwc:identificationRemarks' },
      { id: 'x_individuos', etiqueta: N_('Número de individuos'), tipo: 'numero', despues: 'x_local', estandar: 'dwc:individualCount' },
      { id: 'x_comportamiento', etiqueta: N_('Comportamiento'), tipo: 'opcion', opciones: [N_('Canto'), N_('Llamado'), N_('Alarma'), N_('Coro'), N_('Vuelo'), N_('Alimentación'), N_('Otro')], despues: 'x_individuos', estandar: 'dwc:behavior' },
      { id: 'x_habitat', etiqueta: N_('Hábitat'), tipo: 'texto', despues: 'x_comportamiento', estandar: 'dwc:habitat' },
      { id: 'x_tiempo', etiqueta: N_('Condiciones (clima, viento, lluvia)'), tipo: 'texto', despues: 'x_habitat', estandar: 'dwc:eventRemarks' }
    ]
  }),
  plantillaFabrica('entrevista', N_('Entrevista o sesión de investigación'), N_('Entrevistas, grupos y sesiones (antropología, psicología, educación). Confidencial desde el inicio.'), {
    uso: 'entrevista', seccionesOcultas: ['clips'], predet: { confidencial: true }, obligatorios: ['participantes'],
    ayudas: { participantes: N_('Usa códigos (P01, P02…). La lista que relaciona códigos y nombres guárdala aparte.') },
    extra: [
      { id: 'x_proyecto', etiqueta: N_('Proyecto o estudio'), tipo: 'texto', despues: 'descripcion', estandar: 'dc:relation' },
      { id: 'x_sesion', etiqueta: N_('Número de sesión'), tipo: 'numero', despues: 'x_proyecto' },
      { id: 'x_guia', etiqueta: N_('Guía o protocolo usado'), tipo: 'texto', despues: 'x_sesion' },
      { id: 'x_etica', etiqueta: N_('Aprobación ética o folio'), tipo: 'texto', despues: 'x_guia' }
    ]
  })
];

const Plantillas = {
  lista: [],
  async cargar() {
    let l = null; try { l = await DB.leer('ajustes', 'plantillas'); } catch (e) {}
    if (!Array.isArray(l) || !l.length) { l = PLANTILLAS_FABRICA(); await DB.poner('ajustes', l, 'plantillas').catch(() => {}); }
    this.lista = l;
  },
  guardar() { return DB.poner('ajustes', this.lista, 'plantillas'); },
  de(id) { return this.lista.find(p => p.id === id) || this.lista.find(p => p.id === 'general') || PLANTILLAS_FABRICA()[0]; },
  actual() { return this.de(Ajustes.v.plantilla || 'general'); },
  nombre: p => t(p.nombre),
  referencia(p) { return { id: p.id, nombre: p.nombre, version: p.version }; },
  /** Campos de una plantilla, con su etiqueta final en el idioma de la interfaz. */
  campos(p) { return p.campos.map(c => Object.assign({}, c, { etiqueta: t(c.etiqueta || (CAMPOS_BASE[c.id] || {}).etiqueta || c.id), ayuda: c.ayuda ? t(c.ayuda) : '', etiquetaOriginal: c.etiqueta || (CAMPOS_BASE[c.id] || {}).etiqueta || c.id })); },
  vacio(v) { return v == null || v === '' || v === false || (Array.isArray(v) && !v.length); },
  valor(f, c) {
    if (!c.base) return (f.extra || {})[c.id];
    if (c.id === 'participantes') return (f.participantes || []).filter(x => x.nombre);
    if (c.id === 'confidencial') return true;   // nunca «falta»
    return f[c.id];
  },
  /** Campos obligatorios vacíos de una ficha (más el consentimiento pendiente). */
  faltan(reg) {
    const f = reg.ficha, p = this.de(f.plantilla && f.plantilla.id);
    const l = this.campos(p).filter(c => c.obligatorio && (c.visible || CAMPOS_BASE[c.id] && CAMPOS_BASE[c.id].nucleo) && this.vacio(this.valor(f, c))).map(c => c.etiqueta);
    if (f.consentimiento.estado === 'pendiente') l.push(t('Consentimiento'));
    return l;
  },
  aplicarPredet(f, p) {
    f.plantilla = this.referencia(p); f.extra = f.extra || {};
    if (p.uso && !f.uso) f.uso = p.uso;
    if (p.predet.confidencial) f.confidencial = true;
    if (p.predet.consentimiento && f.consentimiento.estado === 'pendiente' && !f.consentimiento.forma) f.consentimiento.estado = p.predet.consentimiento;
  },
  enUso: async id => (await DB.todas('grabaciones')).filter(r => r.ficha.plantilla && r.ficha.plantilla.id === id).length,

  /* ── Ajustes: lista de plantillas ── */
  pintarAjustes() {
    const d = $('plantillas'); if (!d) return;
    const act = Ajustes.v.plantilla || 'general';
    d.innerHTML = this.lista.map(p => `<div class="tarjeta" style="cursor:default"><div class="cuerpo">
      <h3>${esc(this.nombre(p))} ${p.id === act ? chip(tH('✓ para grabaciones nuevas'), 'ok') : ''}</h3>
      <div class="nota">${esc(t(p.descripcion || ''))}</div>
      <div>${chip('v' + p.version)}${p.equipo ? chip('👥 ' + esc(p.equipo)) : ''}${p.fija ? chip(tH('🔒 fija')) : ''}${p.autoria === 'importada' ? chip(tH('📥 importada')) : ''}${chip(tH('{n} campo(s) propios', { n: p.campos.filter(c => !c.base).length }))}</div>
      <div class="fila fija" style="margin-top:6px">${p.id !== act ? `<button class="chico prim" data-pusar="${p.id}">${tH('Usar')}</button>` : ''}
        <button class="chico" data-peditar="${p.id}">${this.soloLectura(p) ? tH('👁 Ver') : tH('✏️ Editar')}</button><button class="chico" data-pduplicar="${p.id}">${tH('⧉ Duplicar')}</button>
        <button class="chico" data-pexportar="${p.id}">${tH('⬇️ Exportar')}</button>${p.id !== 'general' ? `<button class="chico" data-pborrar="${p.id}" aria-label="${tH('Borrar')}">🗑</button>` : ''}</div></div></div>`).join('');
  },
  soloLectura: p => p.fija && p.autoria === 'importada',
  async usar(id) { Ajustes.v.plantilla = id; await Ajustes.guardar(); this.pintarAjustes(); Ajustes.resumen(); avisar(t('🧩 Las grabaciones nuevas usarán «{nombre}».', { nombre: this.nombre(this.de(id)) })); },
  async duplicar(id) {
    const o = this.de(id), n = JSON.parse(JSON.stringify(o));
    Object.assign(n, { id: 'P' + Date.now().toString(36) + azar(3), nombre: t('{nombre} (copia)', { nombre: this.nombre(o) }), descripcion: t(o.descripcion || ''), version: 1, fija: false, fabrica: false, autoria: 'local', modificada: Date.now() });
    n.campos.forEach(c => { if (c.etiqueta) c.etiqueta = t(c.etiqueta); if (c.ayuda) c.ayuda = t(c.ayuda); });
    this.lista.push(n); await this.guardar(); this.pintarAjustes(); this.editar(n.id);
  },
  async nueva() {
    const n = plantillaFabrica('P' + Date.now().toString(36) + azar(3), t('Plantilla nueva'), '');
    Object.assign(n, { fabrica: false, modificada: Date.now() }); this.lista.push(n); await this.guardar(); this.pintarAjustes(); this.editar(n.id);
  },
  async borrar(id) {
    const p = this.de(id), n = await this.enUso(id);
    if (!confirm(t('¿Borrar la plantilla «{nombre}»?', { nombre: this.nombre(p) }) + (n ? '\n\n' + t('{n} ficha(s) la usan: conservarán sus datos y se verán con la plantilla General.', { n }) : ''))) return;
    this.lista = this.lista.filter(x => x.id !== id); if (Ajustes.v.plantilla === id) { Ajustes.v.plantilla = 'general'; await Ajustes.guardar(); }
    await this.guardar(); this.pintarAjustes();
  },
  async exportar(id) {
    const p = JSON.parse(JSON.stringify(this.de(id))); delete p.autoria; delete p.modificada;
    const f = new File([JSON.stringify({ formato: FORMATO_PLANTILLA, app: 'Vírgula', exportada: fechaISO(Date.now()), plantilla: p }, null, 1)], `plantilla_${ascii(this.nombre(p))}_v${p.version}.json`, { type: 'application/json' });
    await descargarArchivos([f]); avisar(t('⬇️ Plantilla guardada en Descargas. Compártela con tu equipo; la importan en ⚙️ Ajustes → 🧩 Plantillas.'), 6000);
  },
  /** Agrega o actualiza una plantilla que viene de afuera (archivo o paquete). Devuelve qué pasó. */
  async incorporar(p, preguntar) {
    if (!p || !p.id || !Array.isArray(p.campos) || !p.nombre) throw new Error(t('No es una plantilla de Vírgula.'));
    p = Object.assign(plantillaFabrica(p.id, p.nombre, ''), p, { autoria: 'importada', modificada: Date.now() });
    const ya = this.lista.find(x => x.id === p.id);
    if (!ya) { this.lista.push(p); await this.guardar(); return 'nueva'; }
    if (ya.version >= p.version) return 'igual';
    if (ya.autoria === 'local' && !ya.fabrica) {
      if (!preguntar || !confirm(t('Ya tienes «{nombre}» v{v}, hecha en este aparato. ¿Reemplazarla con la v{v2} que llega?', { nombre: this.nombre(ya), v: ya.version, v2: p.version }))) return 'igual';
    }
    Object.assign(ya, p); await this.guardar(); return 'actualizada';
  },
  async importarArchivo(file) {
    try {
      const j = JSON.parse(await file.text());
      if (j.formato !== FORMATO_PLANTILLA) throw new Error(t('El archivo no es una plantilla de Vírgula.'));
      const r = await this.incorporar(j.plantilla, true), nombre = this.nombre(j.plantilla);
      this.pintarAjustes();
      avisar(r === 'nueva' ? t('🧩 Plantilla «{nombre}» agregada.', { nombre }) : r === 'actualizada' ? t('🧩 «{nombre}» actualizada a la v{v}.', { nombre, v: j.plantilla.version }) : t('Ya tenías «{nombre}» en esa versión o una más nueva.', { nombre }), 5000);
    } catch (e) { avisar('⚠️ ' + e.message, 5000); }
  },

  /* ── Editor ── */
  editar(id, borrador) {
    const orig = this.de(id), solo = this.soloLectura(orig), p = borrador || JSON.parse(JSON.stringify(orig)); this.borrador = p;
    const dis = solo ? 'disabled' : '';
    Ventana.abrir(`<h2>🧩 ${solo ? tH('Plantilla') : tH('Editar plantilla')}</h2>
      ${solo ? `<div class="banda aviso">${tH('🔒 Es una plantilla fija de equipo: se usa tal cual. Para cambiarla, duplícala.')}</div>` : ''}
      <label for="plNombre">${tH('Nombre')} *</label><input type="text" id="plNombre" value="${esc(t(p.nombre))}" maxlength="80" ${dis}>
      <label for="plDesc">${tH('Para qué sirve')}</label><input type="text" id="plDesc" value="${esc(t(p.descripcion || ''))}" maxlength="300" ${dis}>
      <div class="fila"><div><label for="plUso">${tH('Uso')}</label><select id="plUso" ${dis}>${Object.entries(USOS).map(([k, n]) => `<option value="${k}" ${k === p.uso ? 'selected' : ''}>${tH(n)}</option>`).join('')}</select></div>
        <div><label for="plCons">${tH('Consentimiento al empezar')}</label><select id="plCons" ${dis}><option value="pendiente">${tH('⏳ Pendiente')}</option><option value="no aplica" ${p.predet.consentimiento === 'no aplica' ? 'selected' : ''}>${tH('No aplica')}</option></select></div></div>
      <div class="op" style="margin-top:8px"><label><input type="checkbox" id="plConf" ${p.predet.confidencial ? 'checked' : ''} ${dis}> ${tH('🔒 Fichas confidenciales desde el inicio')}</label></div>
      <h3>${tH('Campos')}</h3><p class="nota">${tH('Título, fecha y consentimiento son el núcleo: siempre están. Lo demás lo decides tú. Ocultar un campo no borra lo ya escrito.')}</p>
      <div id="plCampos"></div>
      ${solo ? '' : `<div class="fila fija"><button class="chico" id="plAgregar">${tH('＋ Campo propio')}</button></div>`}
      <h3>${tH('Secciones')}</h3><div class="op">${Object.entries(SECCIONES_BASE).map(([k, n]) => `<label><input type="checkbox" data-psec="${k}" ${p.secciones[k] !== false ? 'checked' : ''} ${dis}> ${tH(n)}</label>`).join('')}</div>
      <p class="nota">${tH('Una sección oculta vuelve a aparecer en la ficha si ya tiene datos.')}</p>
      <details class="sec"><summary>${tH('👥 Compartir con un equipo')}</summary>
        <label for="plEquipo">${tH('Equipo o proyecto')}</label><input type="text" id="plEquipo" value="${esc(p.equipo || '')}" maxlength="120" ${dis}>
        <div class="op"><label><input type="checkbox" id="plFija" ${p.fija ? 'checked' : ''} ${dis}> ${tH('🔒 Fija: quien la importe la usa tal cual (puede duplicarla, no cambiarla)')}</label></div>
        <p class="nota">${tH('Para compartirla: ⬇️ Exportar en la lista de plantillas. Cada vez que guardas cambios sube la versión; al importar una versión más nueva, se actualiza.')}</p></details>
      <p class="nota">${tH('Versión {v}', { v: p.version })}${p.fabrica ? ' · ' + tH('plantilla de fábrica') : ''}</p>
      <div class="fila">${solo ? '' : `<button class="prim" id="plGuardar">${tH('💾 Guardar')}</button>`}<button id="plCerrar">${solo ? tH('Cerrar') : tH('Cancelar')}</button>${p.fabrica && !solo ? `<button id="plFabrica">${tH('↺ Volver a la de fábrica')}</button>` : ''}</div>`);
    this.pintarCampos(solo);
    const v = $('velo');
    $('plCerrar').onclick = () => Ventana.cerrar();
    if (solo) return;
    $('plAgregar').onclick = () => { p.campos.push({ id: 'x_' + Date.now().toString(36) + azar(2).toLowerCase(), etiqueta: '', tipo: 'texto', visible: true, obligatorio: false, ayuda: '', opciones: [], estandar: '' }); this.pintarCampos(); const l = v.querySelectorAll('[data-pc][data-k="etiqueta"]'); l[l.length - 1].focus(); };
    $('plGuardar').onclick = () => this.guardarBorrador();
    if ($('plFabrica')) $('plFabrica').onclick = () => {
      const f = PLANTILLAS_FABRICA().find(x => x.id === p.id); if (!f) return;
      f.version = p.version; Ventana.cerrar(); this.editar(p.id, f); avisar(t('Campos de fábrica cargados: toca 💾 Guardar para conservarlos.'));
    };
    v.addEventListener('input', e => {
      const x = e.target, i = x.dataset.pc; if (i == null || x.tagName === 'SELECT') return; const c = p.campos[i], k = x.dataset.k;
      if (x.type === 'checkbox') { c[k] = x.checked; if (k === 'obligatorio' && x.checked) { c.visible = true; this.pintarCampos(); } if (k === 'visible' && !x.checked) { c.obligatorio = false; this.pintarCampos(); } }
      else if (k === 'opciones') c.opciones = x.value.split('\n').map(s => s.trim()).filter(Boolean);
      else c[k] = x.value;
    });
    v.addEventListener('change', e => { const x = e.target; if (x.dataset.pc != null && x.tagName === 'SELECT') { p.campos[x.dataset.pc][x.dataset.k] = x.value; if (x.dataset.k === 'tipo') this.pintarCampos(); } });
    v.addEventListener('click', e => {
      const b = e.target.closest('[data-mover],[data-pquitar]'); if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.mover) { const j = i + Number(b.dataset.mover); if (j < 2 || j >= p.campos.length) return; [p.campos[i], p.campos[j]] = [p.campos[j], p.campos[i]]; this.pintarCampos(); }
      if (b.dataset.pquitar && confirm(t('¿Quitar este campo de la plantilla? Lo ya escrito en las fichas se conserva (aparece en «Otros datos»).'))) { p.campos.splice(i, 1); this.pintarCampos(); }
    });
  },
  pintarCampos(solo) {
    const p = this.borrador, dis = solo ? 'disabled' : '';
    $('plCampos').innerHTML = p.campos.map((c, i) => {
      const base = CAMPOS_BASE[c.id], nucleo = c.base && base && base.nucleo;
      return `<div class="rep"><div class="fila fija">
        <input type="text" data-pc="${i}" data-k="etiqueta" value="${esc(c.etiqueta ? t(c.etiqueta) : '')}" placeholder="${esc(base ? t(base.etiqueta) : t('Nombre del campo *'))}" maxlength="120" aria-label="${tH('Nombre del campo')}" ${dis}>
        ${nucleo || solo ? '' : `<button class="chico" data-mover="-1" data-i="${i}" aria-label="${tH('Subir')}">↑</button><button class="chico" data-mover="1" data-i="${i}" aria-label="${tH('Bajar')}">↓</button>`}</div>
        ${nucleo ? `<p class="nota">${tH('Núcleo: siempre visible y obligatorio.')}</p>` : `<div class="op">
          <label><input type="checkbox" data-pc="${i}" data-k="visible" ${c.visible ? 'checked' : ''} ${dis}> ${tH('Visible')}</label>
          <label><input type="checkbox" data-pc="${i}" data-k="obligatorio" ${c.obligatorio ? 'checked' : ''} ${dis || (c.id === 'confidencial' ? 'disabled' : '')}> ${tH('Obligatorio')}</label>
          ${c.base ? `<span class="nota">${c.etiqueta ? tH('de Vírgula: {nombre}', { nombre: t(base.etiqueta) }) : tH('campo de Vírgula')}</span>` : ''}</div>`}
        ${c.base ? '' : `<div class="fila"><div><label>${tH('Tipo')}</label><select data-pc="${i}" data-k="tipo" ${dis}>${Object.entries(TIPOS_CAMPO).map(([k, n]) => `<option value="${k}" ${k === c.tipo ? 'selected' : ''}>${tH(n)}</option>`).join('')}</select></div>
          <div><label>${tH('Equivale a')}</label><select data-pc="${i}" data-k="estandar" ${dis}>${Object.entries(ESTANDARES).map(([k, n]) => `<option value="${k}" ${k === (c.estandar || '') ? 'selected' : ''}>${tH(n)}</option>`).join('')}</select></div></div>
          ${c.tipo === 'opcion' || c.tipo === 'varias' ? `<label>${tH('Opciones (una por renglón)')}</label><textarea data-pc="${i}" data-k="opciones" rows="3" ${dis}>${esc((c.opciones || []).join('\n'))}</textarea>` : ''}`}
        ${nucleo ? '' : `<input type="text" data-pc="${i}" data-k="ayuda" value="${esc(c.ayuda ? t(c.ayuda) : '')}" placeholder="${tH('Ayuda para quien llena (opcional)')}" maxlength="300" style="margin-top:6px" ${dis}>`}
        ${c.base || solo ? '' : `<div class="fila fija"><button class="chico" data-pquitar="1" data-i="${i}">${tH('✕ Quitar campo')}</button></div>`}</div>`;
    }).join('');
  },
  async guardarBorrador() {
    const p = this.borrador;
    p.nombre = $('plNombre').value.trim(); p.descripcion = $('plDesc').value.trim(); p.uso = $('plUso').value; p.equipo = $('plEquipo').value.trim(); p.fija = $('plFija').checked;
    p.predet = { confidencial: $('plConf').checked, consentimiento: $('plCons').value };
    document.querySelectorAll('[data-psec]').forEach(x => { p.secciones[x.dataset.psec] = x.checked; });
    if (!p.nombre) return avisar(t('La plantilla necesita un nombre.'));
    const sin = p.campos.find(c => !c.base && !c.etiqueta.trim()); if (sin) return avisar(t('Hay un campo propio sin nombre.'));
    const pocas = p.campos.find(c => !c.base && (c.tipo === 'opcion' || c.tipo === 'varias') && (c.opciones || []).length < 2); if (pocas) return avisar(t('«{nombre}» necesita al menos dos opciones.', { nombre: pocas.etiqueta }));
    if (this.lista.some(x => x.id !== p.id && t(x.nombre).toLowerCase() === p.nombre.toLowerCase())) return avisar(t('Ya hay una plantilla con ese nombre.'));
    p.version = (p.version || 1) + 1; p.modificada = Date.now();
    const i = this.lista.findIndex(x => x.id === p.id); this.lista[i] = p;
    await this.guardar(); Ventana.cerrar(); this.pintarAjustes(); Ajustes.resumen(); avisar(t('🧩 «{nombre}» guardada (v{v}).', { nombre: p.nombre, v: p.version }));
  }
};
$('vAjustes').addEventListener('click', e => {
  const b = e.target.closest('[data-pusar],[data-peditar],[data-pduplicar],[data-pexportar],[data-pborrar]'); if (!b) return;
  if (b.dataset.pusar) Plantillas.usar(b.dataset.pusar);
  if (b.dataset.peditar) Plantillas.editar(b.dataset.peditar);
  if (b.dataset.pduplicar) Plantillas.duplicar(b.dataset.pduplicar);
  if (b.dataset.pexportar) Plantillas.exportar(b.dataset.pexportar);
  if (b.dataset.pborrar) Plantillas.borrar(b.dataset.pborrar);
});
$('bPlNueva').onclick = () => Plantillas.nueva();
$('bPlImportar').onclick = () => $('archivoPlantilla').click();
$('archivoPlantilla').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) Plantillas.importarArchivo(f); };
