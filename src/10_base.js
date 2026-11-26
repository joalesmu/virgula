/* ═════════════════ BASE: utilidades, base de datos local, ajustes, interfaz ═════════════════ */
const VERSION = '1.0.0';
const BUILD_INTERNO = '1.3.4';
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

async function mismosDatos(a, b) {
  if (!a || !b || a.size !== b.size) return false;
  const [ab, bb] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const x = new Uint8Array(ab), y = new Uint8Array(bb);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

window.addEventListener('error', e => Bitacora.poner('error', `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
window.addEventListener('unhandledrejection', e => Bitacora.poner('promesa', e.reason && (e.reason.message || e.reason)));

/* ─────────── Base de datos local (IndexedDB) ─────────── */
const DB = {
  db: null,
  abrir() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((ok, mal) => {
      const r = indexedDB.open('virgula', 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('grabaciones')) d.createObjectStore('grabaciones', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('trozos')) d.createObjectStore('trozos', { autoIncrement: true }).createIndex('grabacion', 'grabacion');
        if (!d.objectStoreNames.contains('adjuntos')) d.createObjectStore('adjuntos', { keyPath: 'id' }).createIndex('grabacion', 'grabacion');
        if (!d.objectStoreNames.contains('ajustes')) d.createObjectStore('ajustes');
        if (!d.objectStoreNames.contains('listas')) d.createObjectStore('listas', { keyPath: 'id' });
      };
      r.onblocked = () => avisar(t('Cierra las otras pestañas de Vírgula para completar la actualización del almacenamiento.'), 7000);
      r.onsuccess = () => {
        this.db = r.result;
        this.db.onversionchange = () => { this.db.close(); this.db = null; };
        ok(this.db);
      };
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
  async guardarTrozo(registro) {
    const actuales = await this.porGrabacion('trozos', registro.grabacion);
    const iguales = actuales.filter(x => x.tipo === registro.tipo && x.n === registro.n);

    if (iguales.length) {
      for (const anterior of iguales) {
        if (!await mismosDatos(anterior.datos, registro.datos)) {
          throw new Error(t('Ya existe un fragmento con la misma identidad y datos diferentes.'));
        }
        const a = anterior.inicioFrame, b = registro.inicioFrame;
        if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && a !== b) {
          throw new Error(t('El fragmento duplicado tiene una posición temporal diferente.'));
        }
      }

      if (Number.isSafeInteger(registro.inicioFrame)) {
        await this.fijarInicioFrame(
          registro.grabacion, registro.tipo, registro.n, registro.inicioFrame
        );
      }
      return false;
    }

    await this.poner('trozos', registro);
    return true;
  },
  async fijarInicioFrame(grabacion, tipo, n, inicioFrame) {
    if (!Number.isSafeInteger(inicioFrame) || inicioFrame < 0) return 0;
    const d = await this.abrir();
    return new Promise((ok, mal) => {
      const x = d.transaction('trozos', 'readwrite');
      const s = x.objectStore('trozos');
      const c = s.index('grabacion').openCursor(IDBKeyRange.only(grabacion));
      let cambios = 0;
      c.onsuccess = () => {
        const cursor = c.result;
        if (!cursor) return;
        const v = cursor.value;
        if (v.tipo === tipo && v.n === n && !Number.isSafeInteger(v.inicioFrame)) {
          cursor.update(Object.assign({}, v, { inicioFrame }));
          cambios++;
        }
        cursor.continue();
      };
      x.oncomplete = () => ok(cambios);
      x.onerror = () => mal(x.error);
      x.onabort = () => mal(x.error || new Error(t('No se pudo actualizar la posición del fragmento.')));
    });
  },
  async prepararBorradoOPFS(id) {
    // Primero integrar los respaldos temporales; así un fallo al limpiar OPFS
    // nunca elimina la única copia que contenía un fragmento.
    const resultado = await RespaldoTemporal.recuperar();
    if ((resultado.grabacionesPendientes || []).includes(id)) {
      throw new Error(t('No se pudieron integrar todos los respaldos temporales de esta grabación.'));
    }
    await RespaldoTemporal.borrarGrabacion(id);
  },
  async borrarGrabacion(id) {
    await this.prepararBorradoOPFS(id);
    const d = await this.abrir();
    await new Promise((ok, mal) => {
      const x = d.transaction(['grabaciones', 'trozos', 'adjuntos'], 'readwrite');
      x.objectStore('grabaciones').delete(id);
      ['trozos', 'adjuntos'].forEach(st => {
        const c = x.objectStore(st).index('grabacion').openKeyCursor(IDBKeyRange.only(id));
        c.onsuccess = () => { const k = c.result; if (k) { x.objectStore(st).delete(k.primaryKey); k.continue(); } };
      });
      x.oncomplete = ok;
      x.onerror = () => mal(x.error);
      x.onabort = () => mal(x.error || new Error(t('No se pudo borrar la grabación.')));
    });
  },
  async guardarImportacion(registro, trozosNuevos, adjuntosNuevos, reemplazar = false) {
    const id = registro.id;
    if (reemplazar) {
      await this.prepararBorradoOPFS(id);
    } else if (await this.leer('grabaciones', id)) {
      throw new Error(t('Ya existe una grabación con ese código.'));
    }

    const idsAdjuntos = new Set();
    for (const adjunto of adjuntosNuevos) {
      if (!adjunto || typeof adjunto.id !== 'string' || !adjunto.id) {
        throw new Error(t('La importación contiene un adjunto sin código válido.'));
      }
      if (idsAdjuntos.has(adjunto.id)) {
        throw new Error(t('La importación contiene códigos de adjunto repetidos.'));
      }
      idsAdjuntos.add(adjunto.id);
      const existente = await this.leer('adjuntos', adjunto.id);
      if (existente && (!reemplazar || existente.grabacion !== id)) {
        throw new Error(t('El código de un adjunto ya pertenece a otra grabación.'));
      }
    }

    const d = await this.abrir();
    let clavesTrozo = [], clavesAdjunto = [];
    if (reemplazar) {
      [clavesTrozo, clavesAdjunto] = await Promise.all([
        this.tx('trozos', 'readonly', store => store.index('grabacion').getAllKeys(id)),
        this.tx('adjuntos', 'readonly', store => store.index('grabacion').getAllKeys(id))
      ]);
    }

    return new Promise((ok, mal) => {
      const x = d.transaction(['grabaciones', 'trozos', 'adjuntos'], 'readwrite');
      const grabaciones = x.objectStore('grabaciones');
      const trozos = x.objectStore('trozos');
      const adjuntos = x.objectStore('adjuntos');

      if (reemplazar) {
        grabaciones.delete(id);
        clavesTrozo.forEach(k => trozos.delete(k));
        clavesAdjunto.forEach(k => adjuntos.delete(k));
      }

      grabaciones.put(registro);
      trozosNuevos.forEach(v => trozos.add(v));
      adjuntosNuevos.forEach(v => adjuntos.add(v));

      x.oncomplete = () => ok(true);
      x.onerror = () => mal(x.error);
      x.onabort = () => mal(x.error || new Error(t('No se pudo completar la importación.')));
    });
  }
};

  
/* ─────────── Respaldo temporal de audio (OPFS) ─────────── */
const RespaldoTemporal = {
  directorio: null,

  disponible() {
    return !!(
      navigator.storage &&
      typeof navigator.storage.getDirectory === 'function' &&
      typeof FileSystemFileHandle !== 'undefined' &&
      typeof FileSystemFileHandle.prototype.createWritable === 'function'
    );
  },

  async abrir() {
    if (!this.disponible()) {
      throw new Error(t('El navegador no admite respaldo temporal OPFS.'));
    }

    if (!this.directorio) {
      this.directorio = await navigator.storage.getDirectory();
    }

    return this.directorio;
  },

  nombre(grabacion, tipo, n, inicioFrame = null) {
    const posicion = tipo === 'archivo' && Number.isSafeInteger(inicioFrame) && inicioFrame >= 0
      ? `--${inicioFrame}`
      : '';
    return `virgula-audio--${encodeURIComponent(grabacion)}--${tipo}--${n}${posicion}.pending`;
  },

  async guardar(registro) {
    const dir = await this.abrir();

    const nombre = this.nombre(
      registro.grabacion,
      registro.tipo,
      registro.n,
      registro.inicioFrame
    );

    const archivo = await dir.getFileHandle(nombre, { create: true });
    const salida = await archivo.createWritable();

    try {
      await salida.write(registro.datos);
      await salida.close();
    } catch (e) {
      try {
        await salida.abort();
      } catch (_) {}

      throw e;
    }

    return nombre;
  },

  async quitar(nombre) {
    const dir = await this.abrir();

    try {
      await dir.removeEntry(nombre);
    } catch (e) {
      if (e.name !== 'NotFoundError') throw e;
    }
  },

  async listar(grabacion = null) {
    if (!this.disponible()) return [];

    const dir = await this.abrir();
    const encontrados = [];

    for await (const [nombre, entrada] of dir.entries()) {
      const m = nombre.match(
        /^virgula-audio--(.+)--(archivo|consulta)--([1-9]\d*)(?:--(0|[1-9]\d*))?\.pending$/
      );

      if (!m) continue;

      let id;

      try {
        id = decodeURIComponent(m[1]);
      } catch (_) {
        continue;
      }

      if (grabacion && id !== grabacion) continue;

      const n = Number(m[3]);
      const inicioFrame = m[4] == null ? null : Number(m[4]);
      if (!Number.isSafeInteger(n) || (inicioFrame != null && !Number.isSafeInteger(inicioFrame))) continue;
      if (m[2] === 'consulta' && inicioFrame != null) continue;

      const archivo = await entrada.getFile();

      encontrados.push({
        nombre,
        grabacion: id,
        tipo: m[2],
        n,
        inicioFrame,
        archivo
      });
    }

    return encontrados.sort((a, b) => a.n - b.n);
  },

  
  async recuperar() {
    if (!this.disponible()) {
      return { recuperados: 0, pendientes: 0, grabacionesPendientes: [] };
    }

    const archivos = await this.listar();
    const afectados = new Set();
    const grabacionesPendientes = new Set();
    let recuperados = 0;
    let pendientes = 0;

    for (const respaldo of archivos) {
      const id = respaldo.grabacion;

      try {
        const reg = await DB.leer('grabaciones', id);
        if (!reg) {
          pendientes++;
          grabacionesPendientes.add(id);
          Bitacora.poner('respaldo sin ficha', `${id} · ${respaldo.nombre}`);
          continue;
        }

        let frames = 0;
        if (respaldo.tipo === 'archivo') {
          const canales = reg.tecnica && reg.tecnica.canales;
          if (canales !== 1 && canales !== 2) {
            throw new Error(t('No se pudo determinar el número de canales.'));
          }
          frames = respaldo.archivo.size / (2 * canales);
          if (!Number.isSafeInteger(frames)) {
            throw new Error(t('El tamaño del audio PCM no es válido.'));
          }
        }

        const mime = respaldo.tipo === 'consulta'
          ? ((reg.tecnica && reg.tecnica.mime) || 'application/octet-stream').split(';')[0]
          : 'application/octet-stream';

        const nuevo = {
          grabacion: id,
          tipo: respaldo.tipo,
          n: respaldo.n,
          datos: new Blob([respaldo.archivo], { type: mime }),
          frames,
          ...(Number.isSafeInteger(respaldo.inicioFrame) ? { inicioFrame: respaldo.inicioFrame } : {})
        };

        const insertado = await DB.guardarTrozo(nuevo);
        afectados.add(id);
        if (insertado) recuperados++;

        // La copia temporal solo se retira después de comprobar la copia principal.
        try {
          await this.quitar(respaldo.nombre);
        } catch (e) {
          Bitacora.poner('limpieza respaldo', e && e.message ? e.message : String(e));
        }

      } catch (e) {
        pendientes++;
        grabacionesPendientes.add(id);
        Bitacora.poner(
          'recuperación temporal',
          e && e.message ? e.message : String(e)
        );
      }
    }

    // Recalcular los tamaños y el último frame conservado de cada grabación afectada.
    for (const id of afectados) {
      try {
        const reg = await DB.leer('grabaciones', id);
        if (!reg) continue;
        const trozos = await DB.porGrabacion('trozos', id);
        const archivo = trozos.filter(x => x.tipo === 'archivo').sort((a, b) => a.n - b.n);
        const canales = reg.tecnica && reg.tecnica.canales;
        let cursor = 0;

        if (canales === 1 || canales === 2) {
          for (const x of archivo) {
            const fr = x.datos.size / (2 * canales);
            if (!Number.isSafeInteger(fr)) throw new Error(t('Un fragmento PCM tiene un tamaño inválido.'));
            const inicio = Number.isSafeInteger(x.inicioFrame) ? x.inicioFrame : cursor;
            if (inicio < cursor) throw new Error(t('Los fragmentos recuperados se superponen en el tiempo.'));
            cursor = inicio + fr;
          }
          reg.frames = Math.max(Number.isSafeInteger(reg.frames) ? reg.frames : 0, cursor);
        }

        reg.bytes = {
          archivo: archivo.reduce((a, x) => a + x.datos.size, 0),
          consulta: trozos.filter(x => x.tipo === 'consulta').reduce((a, x) => a + x.datos.size, 0)
        };
        await DB.poner('grabaciones', reg);
      } catch (e) {
        Bitacora.poner('actualización de tamaños', e && e.message ? e.message : String(e));
        grabacionesPendientes.add(id);
      }
    }

    return {
      recuperados,
      pendientes,
      grabacionesPendientes: [...grabacionesPendientes]
    };
  },

  async borrarGrabacion(id) {
    const archivos = await this.listar(id);

    for (const archivo of archivos) {
      await this.quitar(archivo.nombre);
    }
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
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = v.tema === 'claro' ? '#f4f1e8' : v.tema === 'contraste' ? '#000000' : '#14283b';
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
    try {
      const [e, persistido] = await Promise.all([
        this.datos(),
        navigator.storage && typeof navigator.storage.persisted === 'function'
          ? navigator.storage.persisted().catch(() => null)
          : Promise.resolve(null)
      ]);
      if (e) {
        const min = Math.floor(e.libre / this.porMinuto());
        $('espacio').textContent = t('💾 Vírgula usa {usado}. Con estos ajustes caben unas {h} h {m} min más de grabación.', { usado: mb(e.usado), h: Math.floor(min / 60), m: min % 60 });
      } else {
        $('espacio').textContent = t('Este navegador no informa del espacio disponible.');
      }
      const estado = $('estadoPersistencia');
      if (estado) {
        estado.textContent = persistido === true
          ? t('Protección del almacenamiento: concedida. El navegador reducirá el riesgo de eliminar los datos de Vírgula automáticamente.')
          : persistido === false
            ? t('Protección del almacenamiento: no concedida. El navegador podría eliminar datos locales si necesita espacio.')
            : t('Este navegador no permite consultar la protección del almacenamiento. Exporta respaldos periódicamente.');
        estado.classList.toggle('aviso', persistido === false);
      }
    } catch (e) {
      Bitacora.poner('consulta de almacenamiento', e && e.message ? e.message : String(e));
      if ($('espacio')) $('espacio').textContent = t('No se pudo consultar el espacio disponible.');
    }
  }
};

/* ─────────── Interfaz: avisos, ventanas, navegación ─────────── */
function avisar(texto, ms = 3500) {
  document.querySelectorAll('.aviso-toast').forEach(x => x.remove());   // uno a la vez, sin encimarse
  const d = document.createElement('div'); d.className = 'aviso-toast'; d.setAttribute('role', 'status'); d.textContent = texto;
  document.body.appendChild(d); setTimeout(() => d.remove(), ms);
}
/** Botón «atrás» del teléfono: cierra la ventana abierta, vuelve de la ficha al Acervo y nunca sale de la app mientras se graba. */
const Atras = {
  ignorar: false,
  abierto() { return !!$('velo') || Nav.actual === 'vFicha' || Nav.actual === 'vListas' || !!G; },
  abrir() { if (!(history.state && history.state.capa)) history.pushState({ capa: true }, ''); },
  cerrar() { if (this.ignorar) return; if (history.state && history.state.capa && !this.abierto()) { this.ignorar = true; history.back(); } },   // nunca dos pasos atrás pendientes
  alVolver() {
    if (this.ignorar) { this.ignorar = false; if (this.abierto()) this.abrir(); return; }
    if ($('velo')) Ventana.cerrar(true);
    else if (G) avisar(t('🎙️ Se está grabando. Para terminar, toca ⏹ Detener.'), 4000);
    else if (Nav.actual === 'vFicha') Nav.ir('vAcervo', true);
    else if (Nav.actual === 'vListas') {
      if (ListaTrabajo.hayCambiosSinGuardar() && !confirm(t('Hay cambios en la lista que no se han guardado. ¿Salir sin guardarlos?'))) {
        this.abrir();
        return;
      }
      Nav.ir('vGrabar', true, true);
    }
    if (this.abierto()) this.abrir();
  }
};
window.addEventListener('popstate', () => Atras.alVolver());

const Ventana = {
  abrir(html, alCerrar) {
    this.cerrar(true);
    Atras.abrir();
    const v = document.createElement('div'); v.className = 'velo'; v.id = 'velo';
    v.innerHTML = `<div class="ventana" role="dialog" aria-modal="true">${html}</div>`;
    v.addEventListener('click', e => { if (e.target === v) this.cerrar(); });
    document.body.appendChild(v); this.alCerrar = alCerrar;
    const f = v.querySelector('input,select,textarea,button'); if (f) f.focus();
    return v.firstElementChild;
  },
  cerrar(desdeAtras) {
    const v = $('velo'); if (!v) return;
    v.remove(); if (this.alCerrar) { const f = this.alCerrar; this.alCerrar = null; f(); }
    if (!desdeAtras) Atras.cerrar();
  }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') Ventana.cerrar(); });
const Nav = {
  actual: 'vGrabar',
  ir(id, desdeAtras, listaConfirmada = false) {
    if (G && id !== 'vGrabar' && !confirm(t('Se está grabando. ¿Ver otra sección? La grabación sigue.'))) return;
    if (!listaConfirmada && this.actual === 'vListas' && id !== 'vListas' && ListaTrabajo.hayCambiosSinGuardar() &&
        !confirm(t('Hay cambios en la lista que no se han guardado. ¿Salir sin guardarlos?'))) return;
    const vistaAnterior = this.actual;
    document.querySelectorAll('.vista').forEach(v => v.classList.toggle('oculto', v.id !== id));
    document.querySelectorAll('nav.abajo button').forEach(b => b.classList.toggle('on', b.dataset.vista === id || (id === 'vFicha' && b.dataset.vista === 'vAcervo')));
    if (id === 'vAcervo') Acervo.pintar();
    if (id === 'vListas' && vistaAnterior !== 'vListas') ListaTrabajo.pintar();
    if (id === 'vAjustes') { Espacio.actualizar(); Plantillas.pintarAjustes(); Idioma.pintar(); pintarBaseTraduccion(); }
    this.actual = id; window.scrollTo(0, 0);
    if (Atras.abierto()) Atras.abrir(); else if (!desdeAtras) Atras.cerrar();
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

