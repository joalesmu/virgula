'use strict';
/* ═════════════════ BASE: utilidades, base de datos local, ajustes, interfaz ═════════════════ */
const VERSION = '1.0-etapa1';
const FORMATO_PAQUETE = 'virgula-paquete-1';
const $ = id => document.getElementById(id);
const dos = n => String(n).padStart(2, '0');
const reloj = s => { s = Math.max(0, Math.floor(s || 0)); return `${dos(Math.floor(s / 3600))}:${dos(Math.floor(s / 60) % 60)}:${dos(s % 60)}`; };
const relojFino = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return `${dos(m)}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; };
const mb = b => (b / 1048576).toFixed(b < 10485760 ? 2 : 1) + ' MB';
const sello = d => `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}`;
const fechaBonita = t => new Date(t).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const fechaISO = t => { const d = new Date(t); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const chip = (t, tipo = '') => `<span class="chip ${tipo}">${t}</span>`;
const azar = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
/** Nombre de archivo seguro (conserva acentos y letras de cualquier lengua; quita lo que los sistemas no aceptan). */
const nombreArchivo = (s, max = 60) => String(s || '').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).replace(/[ .]+$/, '');
const leerRadio = n => (document.querySelector(`input[name="${n}"]:checked`) || {}).value;
const marcarRadio = (n, v) => { const r = document.querySelector(`input[name="${n}"][value="${v}"]`); if (r) r.checked = true; };

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
      const t = d.transaction(store, modo), s = t.objectStore(store);
      let res; const r = fn(s); if (r) r.onsuccess = () => { res = r.result; };
      t.oncomplete = () => ok(res); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error);
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
      const t = d.transaction(['grabaciones', 'trozos', 'adjuntos'], 'readwrite');
      t.objectStore('grabaciones').delete(id);
      ['trozos', 'adjuntos'].forEach(st => {
        const c = t.objectStore(st).index('grabacion').openKeyCursor(IDBKeyRange.only(id));
        c.onsuccess = () => { const k = c.result; if (k) { t.objectStore(st).delete(k.primaryKey); k.continue(); } };
      });
      t.oncomplete = ok; t.onerror = () => mal(t.error);
    });
  }
};

/* ─────────── Ajustes del aparato ─────────── */
const AJUSTES_BASE = { calidad: 'ambas', canales: 1, volAuto: false, ruido: false, eco: false, mic: '', quien: '', derechos: '', ubic: 'aprox1' };
const Ajustes = {
  v: Object.assign({}, AJUSTES_BASE),
  async cargar() { try { Object.assign(this.v, (await DB.leer('ajustes', 'ajustes')) || {}); } catch (e) {} this.pintar(); },
  guardar() { return DB.poner('ajustes', this.v, 'ajustes').catch(() => {}); },
  pintar() {
    marcarRadio('aCalidad', this.v.calidad); marcarRadio('aCanales', String(this.v.canales)); marcarRadio('aUbic', this.v.ubic);
    $('aVolAuto').checked = this.v.volAuto; $('aRuido').checked = this.v.ruido; $('aEco').checked = this.v.eco;
    $('aQuien').value = this.v.quien; $('aDerechos').value = this.v.derechos;
    if (this.v.mic && ![...$('aMic').options].some(o => o.value === this.v.mic)) $('aMic').insertAdjacentHTML('beforeend', `<option value="${esc(this.v.mic)}">${esc(this.v.micNombre || 'Micrófono elegido')}</option>`);
    $('aMic').value = this.v.mic;
    this.resumen();
  },
  leerFormulario() {
    Object.assign(this.v, { calidad: leerRadio('aCalidad') || 'ambas', canales: Number(leerRadio('aCanales') || 1), ubic: leerRadio('aUbic') || 'aprox1',
      volAuto: $('aVolAuto').checked, ruido: $('aRuido').checked, eco: $('aEco').checked, mic: $('aMic').value,
      micNombre: ($('aMic').selectedOptions[0] || {}).textContent || '', quien: $('aQuien').value.trim(), derechos: $('aDerechos').value.trim() });
    this.guardar(); this.resumen(); Espacio.actualizar();
  },
  resumen() {
    const v = this.v, cal = { ambas: 'archivo + consulta', archivo: 'solo archivo', consulta: 'solo consulta' }[v.calidad];
    const aj = [v.volAuto && 'volumen automático', v.ruido && 'sin ruido', v.eco && 'sin eco'].filter(Boolean);
    $('resumenAjustes').textContent = `${cal} · ${v.canales === 2 ? 'estéreo' : 'mono'} · ${aj.length ? 'aparato: ' + aj.join(', ') : 'sonido sin alterar'} · ${v.micNombre && v.mic ? v.micNombre : 'micrófono predeterminado'}`;
  }
};

/* ─────────── Espacio disponible (cifras medidas en la prueba técnica) ─────────── */
const MB_MIN = { archivo: 5.5 * 1048576, consulta: 0.35 * 1048576 };
const Espacio = {
  async datos() { if (!navigator.storage || !navigator.storage.estimate) return null; const e = await navigator.storage.estimate(); return { usado: e.usage || 0, cuota: e.quota || 0, libre: Math.max(0, (e.quota || 0) - (e.usage || 0)) }; },
  porMinuto() { const v = Ajustes.v; return ((v.calidad !== 'consulta' ? MB_MIN.archivo : 0) + (v.calidad !== 'archivo' ? MB_MIN.consulta : 0)) * (v.canales === 2 ? 2 : 1); },
  async actualizar() {
    const e = await this.datos(); if (!e) { $('espacio').textContent = ''; return; }
    const min = Math.floor(e.libre / this.porMinuto());
    $('espacio').textContent = `💾 Vírgula usa ${mb(e.usado)}. Con estos ajustes caben unas ${Math.floor(min / 60)} h ${min % 60} min más de grabación.`;
  }
};

/* ─────────── Interfaz: avisos, ventanas, navegación ─────────── */
function avisar(texto, ms = 3500) {
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
    if (G && id !== 'vGrabar' && !confirm('Se está grabando. ¿Ver otra sección? La grabación sigue.')) return;
    document.querySelectorAll('.vista').forEach(v => v.classList.toggle('oculto', v.id !== id));
    document.querySelectorAll('nav.abajo button').forEach(b => b.classList.toggle('on', b.dataset.vista === id || (id === 'vFicha' && b.dataset.vista === 'vAcervo')));
    this.actual = id; window.scrollTo(0, 0);
    if (id === 'vAcervo') Acervo.pintar();
    if (id === 'vAjustes') Espacio.actualizar();
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
