'use strict';
/* ═════════════════ IDIOMA DE LA INTERFAZ ═════════════════
   El texto en español ES la clave: t('Grabar') devuelve la traducción del idioma elegido o, si falta, el español.
   · t(texto, {var})  → texto plano (para avisos, confirmaciones, textContent).
   · tH(texto, {var}) → para HTML: escapa todo y solo admite **negritas**. Una traducción nunca puede meter código.
   · N_(texto)        → marca un texto para traducirlo después (listas, plantillas de fábrica).
   construir.py reúne todos los textos marcados en TEXTOS_FUENTE: de ahí sale la plantilla de traducción. */
const N_ = s => s;
const CORREO_PROYECTO = 'joalesmu@gmail.com';
const REPO = 'https://github.com/joalesmu/virgula';
const FORMATO_IDIOMA = 'virgula-idioma-1';
const RE_VAR = /\{(\w+)\}/g;

const Idioma = {
  codigo: 'es', locale: 'es-MX', textos: {}, paquete: null, instalados: [],
  buscar(s) { const r = this.textos[s]; return r != null && r !== '' ? r : s; },
  t(s, v) { const r = this.buscar(s); return v ? r.replace(RE_VAR, (m, k) => v[k] != null ? v[k] : m) : r; },
  tH(s, v) {
    let r = esc(this.buscar(s)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    return v ? r.replace(RE_VAR, (m, k) => v[k] != null ? esc(v[k]) : m) : r;
  },
  /** Traduce lo escrito en el HTML: data-t (texto), data-tp (placeholder), data-ta (aria-label). */
  traducirDom(raiz = document) {
    raiz.querySelectorAll('[data-t]').forEach(el => { if (el.dataset.tOrig == null) el.dataset.tOrig = el.textContent.trim(); el.textContent = this.t(el.dataset.tOrig); });
    raiz.querySelectorAll('[data-tp]').forEach(el => { el.placeholder = this.t(el.dataset.tp); });
    raiz.querySelectorAll('[data-ta]').forEach(el => { el.setAttribute('aria-label', this.t(el.dataset.ta)); });
  },
  async cargar() {
    try { this.instalados = (await DB.leer('ajustes', 'idiomas')) || []; } catch (e) { this.instalados = []; }
    const p = this.instalados.find(x => x.codigo === Ajustes.v.idioma);
    if (p) { this.paquete = p; this.codigo = p.codigo; this.locale = p.locale || 'es-MX'; this.textos = p.textos || {}; }
    document.documentElement.lang = this.codigo;
    this.traducirDom();
  },
  guardar() { return DB.poner('ajustes', this.instalados, 'idiomas'); },
  /** Cuánto de la interfaz está traducido (0–100). */
  avance(p) { const n = TEXTOS_FUENTE.length; if (!n) return 100; return Math.round(TEXTOS_FUENTE.filter(([s]) => p.textos[s]).length / n * 100); },
  /** Revisa un paquete que viene de afuera; lo que no cumple se descarta (y ese texto queda en español). */
  validar(p) {
    if (!p || p.formato !== FORMATO_IDIOMA) throw new Error(t('El archivo no es un idioma de Vírgula.'));
    const codigo = String(p.codigo || '').trim();
    if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(codigo)) throw new Error(t('Falta el código de la lengua (por ejemplo: hch, nah, en).'));
    if (codigo === 'es') throw new Error(t('El español ya viene incluido.'));
    if (!String(p.nombre || '').trim()) throw new Error(t('Falta el nombre de la lengua.'));
    const textos = {}, raros = [];
    Object.entries(p.textos || {}).forEach(([s, v]) => {
      if (typeof v !== 'string' || !v.trim() || v.length > 4000) return;
      const a = (s.match(RE_VAR) || []).sort().join(), b = (v.match(RE_VAR) || []).sort().join();
      if (a !== b) { raros.push(s); return; }    // las {variables} deben quedar iguales
      textos[s] = v.trim();
    });
    const corto = (x, n) => String(x || '').trim().slice(0, n);
    let locale = corto(p.locale, 20) || 'es-MX'; try { new Intl.DateTimeFormat(locale); } catch (e) { locale = 'es-MX'; }
    return { paquete: { formato: FORMATO_IDIOMA, codigo, nombre: corto(p.nombre, 80), nombreEs: corto(p.nombreEs, 80), variante: corto(p.variante, 120), locale,
      traductores: corto(p.traductores, 500), avala: corto(p.avala, 300), licencia: corto(p.licencia, 200) || 'AGPL-3.0', contacto: corto(p.contacto, 200),
      version: Math.max(1, parseInt(p.version, 10) || 1), prueba: !!p.prueba, textos }, raros };
  },
  async instalar(p, { usar } = {}) {
    const { paquete, raros } = this.validar(p);
    this.instalados = this.instalados.filter(x => x.codigo !== paquete.codigo).concat([paquete]);
    await this.guardar();
    if (usar) await this.elegir(paquete.codigo);
    return { paquete, raros };
  },
  async elegir(codigo) {
    if (G) return avisar(t('Termina la grabación antes de cambiar el idioma.'));
    Ajustes.v.idioma = codigo; await Ajustes.guardar(); location.reload();
  },
  async quitar(codigo) {
    const p = this.instalados.find(x => x.codigo === codigo);
    if (!p || !confirm(t('¿Quitar el idioma «{nombre}» de este aparato?', { nombre: p.nombre }))) return;
    this.instalados = this.instalados.filter(x => x.codigo !== codigo); await this.guardar();
    if (Ajustes.v.idioma === codigo) return this.elegir('es');
    this.pintar();
  },

  /* ── Ajustes → Idioma ── */
  pintar() {
    const d = $('idiomas'); if (!d) return;
    const act = Ajustes.v.idioma || 'es';
    d.innerHTML = `<div class="op" role="radiogroup">
        <label><input type="radio" name="aIdioma" value="es" ${act === 'es' ? 'checked' : ''}> Español</label>
        ${this.instalados.map(p => `<label><input type="radio" name="aIdioma" value="${esc(p.codigo)}" ${act === p.codigo ? 'checked' : ''}> ${esc(p.nombre)}${p.prueba ? ' 🧪' : ''} <span class="nota" style="margin:0">${this.avance(p)} %</span></label>`).join('')}</div>
      ${this.paquete ? `<p class="nota">${tH('Traducción: {quien}', { quien: this.paquete.traductores || '—' })}${this.paquete.avala ? ' · ' + tH('Avala: {quien}', { quien: this.paquete.avala }) : ''} · v${this.paquete.version} · ${esc(this.paquete.licencia)}${this.paquete.prueba ? ' · ' + tH('en prueba') : ''}</p>
        <div class="fila fija"><button class="chico" data-iquitar="${esc(this.paquete.codigo)}">${tH('✕ Quitar este idioma')}</button></div>` : ''}
      <div id="idiomasRed"></div>`;
  },
  async buscarPublicados() {
    const d = $('idiomasRed'); d.innerHTML = `<p class="nota">${tH('Buscando…')}</p>`;
    try {
      const r = await fetch('idiomas/lista.json', { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
      const l = ((await r.json()).idiomas || []).filter(x => x && x.codigo && x.archivo);
      d.innerHTML = l.length ? `<p class="nota">${tH('Idiomas publicados:')}</p>` + l.map(x => {
        const ya = this.instalados.find(p => p.codigo === x.codigo), nuevo = !ya || (x.version || 1) > ya.version;
        return `<div class="fila fija"><span>${esc(x.nombre)} · v${esc(x.version || 1)}${x.avance ? ' · ' + esc(x.avance) + ' %' : ''}</span>${nuevo ? `<button class="chico" data-ibajar="${esc(x.archivo)}">${ya ? tH('⬆️ Actualizar') : tH('⬇️ Instalar')}</button>` : `<span class="chip ok">${tH('instalado')}</span>`}</div>`;
      }).join('') : `<p class="nota">${tH('Todavía no hay idiomas publicados.')}</p>`;
    } catch (e) { d.innerHTML = `<p class="nota">${tH('No se pudo consultar: revisa la conexión a internet.')}</p>`; }
  },
  async bajar(archivo) {
    if (!/^[\w.-]+\.json$/.test(archivo)) return;
    try { const r = await fetch('idiomas/' + archivo, { cache: 'no-store' }); const { paquete } = await this.instalar(await r.json()); avisar(t('🌐 «{nombre}» instalado.', { nombre: paquete.nombre })); this.pintar(); }
    catch (e) { avisar('⚠️ ' + e.message, 5000); }
  },
  async instalarArchivo(file, usar) {
    try {
      const txt = await file.text(), p = /\.csv$/i.test(file.name) || !txt.trim().startsWith('{') ? this.desdeCsv(txt, usar) : JSON.parse(txt);
      const { paquete, raros } = await this.instalar(p, { usar: false });
      avisar(t('🌐 «{nombre}» instalado: {n} % traducido.', { nombre: paquete.nombre, n: this.avance(paquete) }) + (raros.length ? ' ' + t('{n} texto(s) con variables distintas quedaron en español.', { n: raros.length }) : ''), 7000);
      if (usar) setTimeout(() => this.elegir(paquete.codigo), 1800); else this.pintar();
    } catch (e) { avisar('⚠️ ' + e.message, 6000); }
  },

  /* ── Plantilla de traducción (hoja de cálculo) ── */
  META: [['@codigo', N_('Código de la lengua (ISO 639; por ejemplo: hch para wixárika, nah para náhuatl, en para inglés)')],
    ['@nombre', N_('Nombre de la lengua, escrito en esa lengua')], ['@nombre_es', N_('Nombre de la lengua en español')], ['@variante', N_('Variante o región')],
    ['@formato_fechas', N_('Cómo escribir fechas y números (por ejemplo: es-MX o en-US)')], ['@traductores', N_('Quién tradujo')],
    ['@avala', N_('Comunidad, autoridad o institución que revisó y avala la traducción')], ['@licencia', N_('Licencia de la traducción')],
    ['@contacto', N_('Correo o teléfono de contacto (opcional)')], ['@version', N_('Versión de esta traducción (1, 2, 3…)')]],
  plantillaCsv(base) {
    const b = base || { textos: {} }, meta = { '@codigo': b.codigo || '', '@nombre': b.nombre || '', '@nombre_es': b.nombreEs || '', '@variante': b.variante || '', '@formato_fechas': b.locale || 'es-MX',
      '@traductores': b.traductores || '', '@avala': b.avala || '', '@licencia': b.licencia || 'AGPL-3.0 (con crédito a quienes tradujeron)', '@contacto': b.contacto || '', '@version': base ? (b.version || 1) + 1 : 1 };
    const filas = [['texto_original', 'traduccion', 'donde_aparece', 'notas']];
    this.META.forEach(([k, d]) => filas.push([k, meta[k], t('Datos de la traducción'), t(d)]));
    TEXTOS_FUENTE.forEach(([s, donde]) => filas.push([s, b.textos[s] || '', donde, (s.match(RE_VAR) || []).length ? t('Conserva igual lo que está entre llaves: {x}', { x: (s.match(RE_VAR) || []).join(' ') }) : '']));
    return csv(filas);
  },
  desdeCsv(txt, prueba) {
    const filas = leerCsv(txt); if (!filas.length) throw new Error(t('La hoja está vacía.'));
    const cab = filas[0].map(x => x.trim().toLowerCase()), io = cab.indexOf('texto_original'), it = cab.indexOf('traduccion');
    if (io < 0 || it < 0) throw new Error(t('La hoja necesita las columnas texto_original y traduccion.'));
    const meta = {}, textos = {};
    filas.slice(1).forEach(f => { const s = (f[io] || '').trim(), v = (f[it] || '').trim(); if (!s) return; if (s.startsWith('@')) meta[s] = v; else if (v) textos[s] = v; });
    return { formato: FORMATO_IDIOMA, codigo: meta['@codigo'], nombre: meta['@nombre'], nombreEs: meta['@nombre_es'], variante: meta['@variante'], locale: meta['@formato_fechas'],
      traductores: meta['@traductores'], avala: meta['@avala'], licencia: meta['@licencia'], contacto: meta['@contacto'], version: meta['@version'], prueba: !!prueba, textos };
  },
  async bajarPlantilla() {
    const base = this.instalados.find(x => x.codigo === $('tBase').value);
    const f = new File([this.plantillaCsv(base)], `virgula_traduccion_${base ? ascii(base.codigo) + '_v' + ((base.version || 1) + 1) : 'nueva'}.csv`, { type: 'text/csv' });
    await descargarArchivos([f]);
    avisar(t('⬇️ Plantilla en Descargas. Ábrela con Google Sheets, Excel o LibreOffice; llena la columna «traduccion» y guárdala como CSV.'), 8000);
  },
  async enviar() {
    const p = this.paquete && this.paquete.prueba ? this.paquete : this.instalados.find(x => x.prueba) || this.paquete;
    if (!p) return avisar(t('Primero prueba tu traducción con «📥 Probar mi traducción».'), 5000);
    const nombre = `virgula-idioma-${ascii(p.codigo)}-v${p.version}.json`, datos = Object.assign({}, p, { prueba: false });
    await descargarArchivos([new File([JSON.stringify(datos, null, 1)], nombre, { type: 'application/json' })]);
    const asunto = t('Traducción de Vírgula: {nombre} v{v}', { nombre: p.nombre, v: p.version });
    const cuerpo = t('Hola. Envío la traducción de Vírgula a {nombre} ({codigo}), versión {v}, con {n} % de la interfaz.\nTradujo: {quien}\nAvala: {avala}\n\nAdjunto el archivo {archivo} (está en Descargas).',
      { nombre: p.nombre, codigo: p.codigo, v: p.version, n: this.avance(p), quien: p.traductores || '—', avala: p.avala || '—', archivo: nombre });
    Ventana.abrir(`<h2>${tH('📨 Enviar la traducción')}</h2>
      <p>${tH('Se guardó **{archivo}** en Descargas. Envíalo por una de estas vías; el equipo de Vírgula lo revisa y lo publica para todos.', { archivo: nombre })}</p>
      <div class="fila"><a class="boton prim" href="mailto:${CORREO_PROYECTO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}">${tH('✉️ Por correo')}</a>
        <a class="boton" target="_blank" rel="noopener" href="${REPO}/issues/new?title=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo + '\n\n' + t('(Arrastra aquí el archivo para adjuntarlo.)'))}">${tH('🐙 En GitHub')}</a></div>
      <p class="nota">${tH('Por correo: adjunta el archivo antes de enviar. En GitHub: necesitas una cuenta; arrastra el archivo al recuadro del mensaje.')}</p>
      <div class="fila"><button id="envCerrar">${tH('Cerrar')}</button></div>`);
    $('envCerrar').onclick = () => Ventana.cerrar();
  }
};
const t = (s, v) => Idioma.t(s, v);
const tH = (s, v) => Idioma.tH(s, v);

/** CSV de hojas de cálculo: detecta coma, punto y coma o tabulador; respeta comillas y saltos de línea. */
function leerCsv(txt) {
  txt = txt.replace(/^﻿/, '');
  const primera = txt.slice(0, txt.indexOf('\n') + 1 || txt.length), sep = [',', ';', '\t'].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (comillas) { if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += c; continue; }
    if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(x => x.trim()));
}
