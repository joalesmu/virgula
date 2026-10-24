/* ═════════════════ BASE: utilidades, base de datos local, ajustes, interfaz ═════════════════ */
const VERSION = '1.1';
const FORMATO_PAQUETE = 'virgula-paquete-1';
const $ = id => document.getElementById(id);
const dos = n => String(n).padStart(2, '0');
const reloj = s => { s = Math.max(0, Math.floor(s || 0)); return `${dos(Math.floor(s / 3600))}:${dos(Math.floor(s / 60) % 60)}:${dos(s % 60)}`; };
const relojFino = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return `${dos(m)}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; };
const mb = b => (b / 1048576).toFixed(b < 10485760 ? 2 : 1) + ' MB';
const sello = d => `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}`;
const fechaBonita = x => new Date(x).toLocaleString(Idioma.locale, { dateStyle: 'medium', timeStyle: 'short' });
const horaBonita = x => new Date(x).toLocaleTimeString(Idioma.locale);
const fechaISO = x => { const d = new Date(x); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const chip = (html, tipo = '') => `<span class="chip ${tipo}">${html}</span>`;
const azar = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
/** Nombre de archivo seguro (conserva acentos y letras de cualquier lengua; quita lo que los sistemas no aceptan). */
const nombreArchivo = (s, max = 60) => String(s || '').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).replace(/[ .]+$/, '');
/** Solo letras básicas: para nombres de .zip (algunos navegadores descartan ñ, acentos o comillas) y textos ASCII de los WAV. */
const ascii = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-');
const leerRadio = n => (document.querySelector(`input[name="${n}"]:checked`) || {}).value;
const marcarRadio = (n, v) => { const r = document.querySelector(`input[name="${n}"][value="${v}"]`); if (r) r.checked = true; };

/** Vibración (si el aparato puede y la persona no la apagó). */
const vibrar = x => { try { if (Ajustes.v.vibrar !== false && navigator.vibrate) navigator.vibrate(x); } catch (e) {} };
/** iPhone o iPad (los iPad nuevos se presentan como Mac con pantalla táctil). */
const ES_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const INSTALADA = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/* Bitácora técnica breve (para «Reportar un problema»); nunca guarda contenido de fichas */
const Bitacora = { l: [], poner(tipo, txt) { this.l.push(`${new Date().toISOString()} ${tipo}: ${String(txt).slice(0, 300)}`); if (this.l.length > 60) this.l.shift(); } };
window.addEventListener('error', e => Bitacora.poner('error', `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
window.addEventListener('unhandledrejection', e => Bitacora.poner('promesa', e.reason && (e.reason.message || e.reason)));

/* ─────────── Base de datos local (IndexedDB) ─────────── */
const DB = {
  db: null,
  abrir() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((ok, mal) => {
      const r = indexedDB.open('virgula', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('grabaciones', { keyPath: 'id' });
        d.createObjectStore('trozos', { autoIncrement: true }).createIndex('grabacion', 'grabacion');
        d.createObjectStore('adjuntos', { keyPath: 'id' }).createIndex('grabacion', 'grabacion');
        d.createObjectStore('ajustes');
      };
      r.onsuccess = () => { this.db = r.result; ok(this.db); };
      r.onerror = () => mal(r.error);
    });
  },
  async tx(store, modo, fn) {
    const d = await this.abrir();
    return new Promise((ok, mal) => {
      const x = d.transaction(store, modo), s = x.objectStore(store);
      let res; const r = fn(s); if (r) r.onsuccess = () => { res = r.result; };
      x.oncomplete = () => ok(res); x.onerror = () => mal(x.error); x.onabort = () => mal(x.error);
    });
  },
  poner(store, v, k) { return this.tx(store, 'readwrite', s => k === undefined ? s.put(v) : s.put(v, k)); },
  leer(store, k) { return this.tx(store, 'readonly', s => s.get(k)); },
  todas(store) { return this.tx(store, 'readonly', s => s.getAll()); },
  quitar(store, k) { return this.tx(store, 'readwrite', s => s.delete(k)); },
  porGrabacion(store, id) { return this.tx(store, 'readonly', s => s.index('grabacion').getAll(id)); },
  async borrarGrabacion(id) {
    const d = await this.abrir();
    await new Promise((ok, mal) => {
      const x = d.transaction(['grabaciones', 'trozos', 'adjuntos'], 'readwrite');
      x.objectStore('grabaciones').delete(id);
      ['trozos', 'adjuntos'].forEach(st => {
        const c = x.objectStore(st).index('grabacion').openKeyCursor(IDBKeyRange.only(id));
        c.onsuccess = () => { const k = c.result; if (k) { x.objectStore(st).delete(k.primaryKey); k.continue(); } };
      });
      x.oncomplete = ok; x.onerror = () => mal(x.error);
    });
  }
};

/* ─────────── Ajustes del aparato ─────────── */
const AJUSTES_BASE = { calidad: 'ambas', canales: 1, volAuto: false, ruido: false, eco: false, mic: '', quien: '', derechos: '', ubic: 'aprox1', plantilla: 'general', idioma: 'es', diasRespaldo: 3, recordarDesde: 0, escala: 1, tema: 'oscuro', movimiento: false, vibrar: true };
const Ajustes = {
  v: Object.assign({}, AJUSTES_BASE),
  async cargar() { try { Object.assign(this.v, (await DB.leer('ajustes', 'ajustes')) || {}); } catch (e) {} this.aplicarAcceso(); },
  /** Tamaño de letra, colores y movimiento: se aplican a toda la app al momento. */
  aplicarAcceso() {
    const r = document.documentElement, v = this.v;
    r.style.setProperty('--escala', String(v.escala || 1));
    r.dataset.tema = v.tema || 'oscuro'; r.dataset.movimiento = v.movimiento ? 'reducido' : '';
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = v.tema === 'claro' ? '#f6f4ee' : v.tema === 'contraste' ? '#000000' : '#1e3a5f';
    try { localStorage.setItem('virgula-acceso', JSON.stringify({ escala: v.escala, tema: v.tema, movimiento: v.movimiento })); } catch (e) {}
  },
  guardar() { return DB.poner('ajustes', this.v, 'ajustes').catch(() => {}); },
  pintar() {
    marcarRadio('aCalidad', this.v.calidad); marcarRadio('aCanales', String(this.v.canales)); marcarRadio('aUbic', this.v.ubic);
    $('aVolAuto').checked = this.v.volAuto; $('aRuido').checked = this.v.ruido; $('aEco').checked = this.v.eco;
    $('aQuien').value = this.v.quien; $('aDerechos').value = this.v.derechos; $('aDiasRespaldo').value = String(this.v.diasRespaldo);
    marcarRadio('aEscala', String(this.v.escala || 1)); marcarRadio('aTema', this.v.tema || 'oscuro'); $('aMovimiento').checked = !!this.v.movimiento; $('aVibrar').checked = this.v.vibrar !== false;
    if (this.v.mic && ![...$('aMic').options].some(o => o.value === this.v.mic)) $('aMic').insertAdjacentHTML('beforeend', `<option value="${esc(this.v.mic)}">${esc(this.v.micNombre || t('Micrófono elegido'))}</option>`);
    $('aMic').value = this.v.mic;
    this.resumen();
  },
  leerFormulario() {
    Object.assign(this.v, { calidad: leerRadio('aCalidad') || 'ambas', canales: Number(leerRadio('aCanales') || 1), ubic: leerRadio('aUbic') || 'aprox1',
      volAuto: $('aVolAuto').checked, ruido: $('aRuido').checked, eco: $('aEco').checked, mic: $('aMic').value,
      micNombre: ($('aMic').selectedOptions[0] || {}).textContent || '', quien: $('aQuien').value.trim(), derechos: $('aDerechos').value.trim(),
      diasRespaldo: Number($('aDiasRespaldo').value), escala: Number(leerRadio('aEscala') || 1), tema: leerRadio('aTema') || 'oscuro', movimiento: $('aMovimiento').checked, vibrar: $('aVibrar').checked });
    this.guardar(); this.aplicarAcceso(); this.resumen(); Espacio.actualizar();
  },
  resumen() {
    const v = this.v, cal = { ambas: t('archivo + consulta'), archivo: t('solo archivo'), consulta: t('solo consulta') }[v.calidad];
    const aj = [v.volAuto && t('volumen automático'), v.ruido && t('sin ruido'), v.eco && t('sin eco')].filter(Boolean);
    $('resumenAjustes').textContent = [`🧩 ${Plantillas.nombre(Plantillas.actual())}`, cal, v.canales === 2 ? t('estéreo') : t('mono'),
      aj.length ? t('aparato: {lista}', { lista: aj.join(', ') }) : t('sonido sin alterar'), v.micNombre && v.mic ? v.micNombre : t('micrófono predeterminado')].join(' · ');
  }
};

/* Colores y tamaño desde el primer instante (sin parpadeo) */
try { const a = JSON.parse(localStorage.getItem('virgula-acceso') || 'null'); if (a) { Object.assign(Ajustes.v, a); Ajustes.aplicarAcceso(); } } catch (e) {}

/* ─────────── Espacio disponible (cifras medidas en la prueba técnica) ─────────── */
const MB_MIN = { archivo: 5.5 * 1048576, consulta: 0.35 * 1048576 };
const Espacio = {
  async datos() { if (!navigator.storage || !navigator.storage.estimate) return null; const e = await navigator.storage.estimate(); return { usado: e.usage || 0, cuota: e.quota || 0, libre: Math.max(0, (e.quota || 0) - (e.usage || 0)) }; },
  porMinuto() { const v = Ajustes.v; return ((v.calidad !== 'consulta' ? MB_MIN.archivo : 0) + (v.calidad !== 'archivo' ? MB_MIN.consulta : 0)) * (v.canales === 2 ? 2 : 1); },
  async actualizar() {
    const e = await this.datos(); if (!e) { $('espacio').textContent = ''; return; }
    const min = Math.floor(e.libre / this.porMinuto());
    $('espacio').textContent = t('💾 Vírgula usa {usado}. Con estos ajustes caben unas {h} h {m} min más de grabación.', { usado: mb(e.usado), h: Math.floor(min / 60), m: min % 60 });
  }
};

/* ─────────── Interfaz: avisos, ventanas, navegación ─────────── */
function avisar(texto, ms = 3500) {
  document.querySelectorAll('.aviso-toast').forEach(x => x.remove());   // uno a la vez, sin encimarse
  const d = document.createElement('div'); d.className = 'aviso-toast'; d.setAttribute('role', 'status'); d.textContent = texto;
  document.body.appendChild(d); setTimeout(() => d.remove(), ms);
}
const Ventana = {
  abrir(html, alCerrar) {
    this.cerrar();
    const v = document.createElement('div'); v.className = 'velo'; v.id = 'velo';
    v.innerHTML = `<div class="ventana" role="dialog" aria-modal="true">${html}</div>`;
    v.addEventListener('click', e => { if (e.target === v) this.cerrar(); });
    document.body.appendChild(v); this.alCerrar = alCerrar;
    const f = v.querySelector('input,select,textarea,button'); if (f) f.focus();
    return v.firstElementChild;
  },
  cerrar() { const v = $('velo'); if (v) { v.remove(); if (this.alCerrar) { const f = this.alCerrar; this.alCerrar = null; f(); } } }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') Ventana.cerrar(); });
const Nav = {
  actual: 'vGrabar',
  ir(id) {
    if (G && id !== 'vGrabar' && !confirm(t('Se está grabando. ¿Ver otra sección? La grabación sigue.'))) return;
    document.querySelectorAll('.vista').forEach(v => v.classList.toggle('oculto', v.id !== id));
    document.querySelectorAll('nav.abajo button').forEach(b => b.classList.toggle('on', b.dataset.vista === id || (id === 'vFicha' && b.dataset.vista === 'vAcervo')));
    this.actual = id; window.scrollTo(0, 0);
    if (id === 'vAcervo') Acervo.pintar();
    if (id === 'vAjustes') { Espacio.actualizar(); Plantillas.pintarAjustes(); Idioma.pintar(); pintarBaseTraduccion(); }
  }
};
document.querySelectorAll('nav.abajo button').forEach(b => b.addEventListener('click', () => Nav.ir(b.dataset.vista)));

/** Comparte archivos con el menú del aparato; si no se puede, los descarga. */
async function compartirArchivos(archivos, titulo) {
  if (navigator.canShare && navigator.canShare({ files: archivos })) {
    try { await navigator.share({ files: archivos, title: titulo }); return 'compartido'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
  }
  return descargarArchivos(archivos);
}
async function descargarArchivos(archivos) {
  for (const f of archivos) {
    const a = document.createElement('a'), u = URL.createObjectURL(f); a.href = u; a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove(); await new Promise(r => setTimeout(r, 600));
    setTimeout(() => URL.revokeObjectURL(u), 120000);
  }
  return 'descargado';
}
