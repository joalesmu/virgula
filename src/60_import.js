/* ═════════════════ IMPORTAR: un paquete .zip de Vírgula (propio o de otra persona) ═════════════════ */
async function leerZip(file) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 22) {
    throw new Error(t('No parece un archivo .zip.'));
  }

  const cola = Math.min(file.size, 65557);
  const finBlob = await file.slice(file.size - cola).arrayBuffer();
  const fin = new DataView(finBlob);
  let p = -1;
  for (let i = cola - 22; i >= 0; i--) {
    if (fin.getUint32(i, true) === 0x06054b50) { p = i; break; }
  }
  if (p < 0) throw new Error(t('No parece un archivo .zip.'));

  const disco = fin.getUint16(p + 4, true);
  const discoCentral = fin.getUint16(p + 6, true);
  const cantidadDisco = fin.getUint16(p + 8, true);
  const cantidad = fin.getUint16(p + 10, true);
  const tamCentral = fin.getUint32(p + 12, true);
  const inicioCentral = fin.getUint32(p + 16, true);
  const comentario = fin.getUint16(p + 20, true);
  const eocd = file.size - cola + p;

  if (disco || discoCentral || cantidadDisco !== cantidad) {
    throw new Error(t('Vírgula no puede importar archivos .zip divididos en varios discos.'));
  }
  if (cantidad === 0xffff || tamCentral === 0xffffffff || inicioCentral === 0xffffffff) {
    throw new Error(t('Este .zip usa ZIP64; Vírgula aún no lo lee.'));
  }
  if (eocd + 22 + comentario > file.size || inicioCentral + tamCentral > eocd) {
    throw new Error(t('El directorio del .zip está fuera de sus límites.'));
  }

  const centralBytes = await file.slice(inicioCentral, inicioCentral + tamCentral).arrayBuffer();
  const cd = new DataView(centralBytes);
  const dec = new TextDecoder('utf-8', { fatal: true });
  const entradas = Object.create(null);
  let o = 0;

  for (let i = 0; i < cantidad; i++) {
    if (o + 46 > cd.byteLength || cd.getUint32(o, true) !== 0x02014b50) {
      throw new Error(t('El directorio central del .zip está dañado.'));
    }

    const flags = cd.getUint16(o + 8, true);
    const metodo = cd.getUint16(o + 10, true);
    const crc = cd.getUint32(o + 16, true);
    const comp = cd.getUint32(o + 20, true);
    const real = cd.getUint32(o + 24, true);
    const ln = cd.getUint16(o + 28, true);
    const le = cd.getUint16(o + 30, true);
    const lc = cd.getUint16(o + 32, true);
    const loc = cd.getUint32(o + 42, true);
    const finEntrada = o + 46 + ln + le + lc;

    if (finEntrada > cd.byteLength || loc === 0xffffffff || comp === 0xffffffff || real === 0xffffffff) {
      throw new Error(t('El .zip contiene una entrada con tamaños o posiciones no compatibles.'));
    }
    if (flags & 1) throw new Error(t('El .zip está cifrado; Vírgula no puede importarlo.'));
    if (metodo !== 0 && metodo !== 8) throw new Error(t('El .zip usa un método de compresión no compatible.'));

    const nombre = dec.decode(new Uint8Array(centralBytes, o + 46, ln));
    if (!nombre || nombre.startsWith('/') || nombre.includes('\\') || nombre.split('/').some(x => x === '..' || x === '.')) {
      throw new Error(t('El .zip contiene una ruta de archivo no válida.'));
    }
    if (!nombre.endsWith('/')) {
      if (Object.prototype.hasOwnProperty.call(entradas, nombre)) {
        throw new Error(t('El .zip contiene nombres de archivo duplicados.'));
      }
      entradas[nombre] = { flags, metodo, crc, comp, real, loc, nombre };
    }
    o = finEntrada;
  }

  if (o > cd.byteLength) throw new Error(t('El directorio central del .zip está incompleto.'));

  const leer = async ruta => {
    const e = entradas[ruta];
    if (!e) return null;
    if (e.loc + 30 > file.size) throw new Error(t('El encabezado de «{ruta}» está incompleto.', { ruta }));

    const hb = await file.slice(e.loc, e.loc + 30).arrayBuffer();
    if (hb.byteLength !== 30) throw new Error(t('El encabezado de «{ruta}» está incompleto.', { ruta }));
    const h = new DataView(hb);
    if (h.getUint32(0, true) !== 0x04034b50) {
      throw new Error(t('El encabezado local de «{ruta}» está dañado.', { ruta }));
    }

    const flags = h.getUint16(6, true);
    const metodo = h.getUint16(8, true);
    const crcLocal = h.getUint32(14, true);
    const compLocal = h.getUint32(18, true);
    const realLocal = h.getUint32(22, true);
    const ln = h.getUint16(26, true);
    const le = h.getUint16(28, true);
    const inicioDatos = e.loc + 30 + ln + le;
    const finDatos = inicioDatos + e.comp;

    if ((flags & 1) || metodo !== e.metodo || flags !== e.flags || finDatos > file.size) {
      throw new Error(t('El encabezado local de «{ruta}» no coincide con el directorio central.', { ruta }));
    }
    if (!(flags & 8) && (crcLocal !== e.crc || compLocal !== e.comp || realLocal !== e.real)) {
      throw new Error(t('Los tamaños declarados de «{ruta}» no coinciden.', { ruta }));
    }

    const nombreLocal = dec.decode(await file.slice(e.loc + 30, e.loc + 30 + ln).arrayBuffer());
    if (nombreLocal !== ruta) throw new Error(t('El nombre de «{ruta}» no coincide en sus encabezados.', { ruta }));

    const comprimido = file.slice(inicioDatos, finDatos);
    if (comprimido.size !== e.comp) throw new Error(t('El contenido de «{ruta}» está truncado.', { ruta }));

    let datos;
    if (e.metodo === 0) {
      datos = comprimido;
    } else {
      if (!window.DecompressionStream) throw new Error(t('Este navegador no descomprime .zip.'));
      datos = await new Response(
        comprimido.stream().pipeThrough(new DecompressionStream('deflate-raw'))
      ).blob();
    }

    if (datos.size !== e.real) throw new Error(t('La longitud de «{ruta}» no coincide después de descomprimir.', { ruta }));
    const crc = await crc32Blob(datos);
    if (crc !== e.crc) throw new Error(t('La comprobación de integridad de «{ruta}» no coincide.', { ruta }));
    return datos;
  };

  return { rutas: Object.keys(entradas), leer };
}
/** Quita la cabecera de un WAV (busca el bloque «data»; no da por hecho 44 bytes). */
async function pcmDeWav(blob) {
  if (!blob || blob.size < 44) return null;
  const limite = Math.min(blob.size, 1024 * 1024);
  const h = new DataView(await blob.slice(0, limite).arrayBuffer());
  const texto = o => {
    if (o < 0 || o + 4 > h.byteLength) return '';
    return String.fromCharCode(h.getUint8(o), h.getUint8(o + 1), h.getUint8(o + 2), h.getUint8(o + 3));
  };
  if (texto(0) !== 'RIFF' || texto(8) !== 'WAVE') return null;

  let o = 12;
  let info = null;
  while (o + 8 <= h.byteLength) {
    const id = texto(o);
    const n = h.getUint32(o + 4, true);
    const inicio = o + 8;
    const fin = inicio + n;
    if (!Number.isSafeInteger(fin) || fin > blob.size) return null;

    if (id === 'fmt ') {
      if (n < 16 || inicio + 16 > h.byteLength) return null;
      info = {
        formato: h.getUint16(inicio, true),
        canales: h.getUint16(inicio + 2, true),
        sr: h.getUint32(inicio + 4, true),
        bytesSegundo: h.getUint32(inicio + 8, true),
        alineacion: h.getUint16(inicio + 12, true),
        bits: h.getUint16(inicio + 14, true)
      };
    }

    if (id === 'data') {
      if (!info) return null;
      const { formato, canales, sr, bytesSegundo, alineacion, bits } = info;
      if (formato !== 1 || bits !== 16 || (canales !== 1 && canales !== 2) || !Number.isSafeInteger(sr) || sr < 8000) return null;
      if (alineacion !== canales * 2 || bytesSegundo !== sr * alineacion || n % alineacion !== 0 || fin > blob.size) return null;
      const datos = blob.slice(inicio, fin);
      return { ch: canales, sr, bits, datos };
    }

    o = fin + (n & 1);
  }
  return null;
}

const Importar = {
  async paquete(file) {
    avisar(t('📥 Leyendo el paquete…'));
    let z, p;
    try {
      z = await leerZip(file);
      const rj = z.rutas.find(r => /(^|\/)fichas\.json$/.test(r)); if (!rj) throw new Error(t('El paquete no tiene fichas.json: no es un paquete de Vírgula.'));
      this.raiz = rj.slice(0, -'fichas.json'.length);
      p = JSON.parse(await (await z.leer(rj)).text());
      if (!p || !/^virgula-paquete-/.test(p.formato) || !Array.isArray(p.grabaciones)) {
        throw new Error(t('fichas.json no tiene el formato de Vírgula.'));
      }
      if (p.grabaciones.length > 10000) throw new Error(t('El paquete contiene demasiadas grabaciones para importarlo de forma segura.'));
      if (p.listas != null && (!Array.isArray(p.listas) || p.listas.length > 5000)) throw new Error(t('El paquete contiene una colección de listas no válida.'));
      const ids = new Set();
      const idsAdjuntos = new Set();
      for (const g of p.grabaciones) {
        if (!g || typeof g.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(g.id) ||
            !g.ficha || typeof g.ficha !== 'object' || typeof g.ficha.titulo !== 'string' ||
            !g.tecnica || typeof g.tecnica !== 'object') {
          throw new Error(t('El paquete contiene una ficha o un código de grabación inválido.'));
        }
        if (ids.has(g.id)) throw new Error(t('El paquete repite el código de una grabación.'));
        ids.add(g.id);

        if (g.adjuntos != null && !Array.isArray(g.adjuntos)) {
          throw new Error(t('El paquete contiene una lista de adjuntos no válida.'));
        }
        for (const adjunto of g.adjuntos || []) {
          if (!adjunto || typeof adjunto.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(adjunto.id)) {
            throw new Error(t('El paquete contiene un adjunto con código no válido.'));
          }
          if (idsAdjuntos.has(adjunto.id)) {
            throw new Error(t('El paquete repite el código de un adjunto.'));
          }
          idsAdjuntos.add(adjunto.id);
        }
      }
    } catch (e) { return avisar('⚠️ ' + e.message, 6000); }
    const ya = [];
    for (const g of p.grabaciones) if (await DB.leer('grabaciones', g.id)) ya.push(g);
    const nuevas = p.grabaciones.length - ya.length;
    Ventana.abrir(`<h2>${tH('📥 Importar paquete')}</h2>
      <p>${esc(file.name)} · ${mb(file.size)}<br>${tH('{n} grabación(es)', { n: p.grabaciones.length })} · ${tH('exportado el {fecha}', { fecha: String(p.exportado || '').replace('T', ' ') })}</p>
      <ul>${p.grabaciones.slice(0, 12).map(g => `<li>${esc(g.ficha.titulo)} · ${reloj(g.duracion)}${ya.includes(g) ? ` <span class="chip aviso">${tH('ya está')}</span>` : ''}</li>`).join('')}${p.grabaciones.length > 12 ? '<li>…</li>' : ''}</ul>
      ${ya.length ? `<div class="op"><label><input type="radio" name="iYa" value="saltar" checked> ${tH('Dejar como están las {n} que ya tengo', { n: ya.length })}</label><label><input type="radio" name="iYa" value="reemplazar"> ${tH('Reemplazarlas con las del paquete')}</label></div>` : ''}
      ${(p.plantillas || []).length ? `<p class="nota">${tH('Trae {n} plantilla(s); las que no tengas se agregan.', { n: p.plantillas.length })}</p>` : ''}
      <p class="nota" id="iProg"></p>
      <div class="fila"><button class="prim" id="iOk" ${!nuevas && !ya.length ? 'disabled' : ''}>${tH('📥 Importar')}</button><button id="iNo">${tH('Cancelar')}</button></div>`);
    $('iNo').onclick = () => Ventana.cerrar();
    $('iOk').onclick = async () => {
      const reemplazar = leerRadio('iYa') === 'reemplazar'; $('iOk').disabled = true;
      let n = 0, aviso = [];
      for (const pl of (p.plantillas || [])) { try { await Plantillas.incorporar(pl, false); } catch (e) {} }
      for (const lista of (p.listas || [])) { try { await ListaTrabajo.incorporar(lista); } catch (e) { Bitacora.poner('importar lista', e && e.message ? e.message : String(e)); } }
      for (const g of p.grabaciones) {
        if (ya.includes(g) && !reemplazar) continue;
        $('iProg').textContent = t('Importando «{titulo}»…', { titulo: g.ficha.titulo });
        try { aviso.push(...await this.una(z, g, ya.includes(g))); n++; } catch (e) { aviso.push(`«${g.ficha.titulo}»: ${e.message}`); }
      }
      Ventana.cerrar();
      avisar(t('📥 {n} grabación(es) importada(s).', { n }) + (aviso.length ? ' ⚠️ ' + aviso.join(' · ') : ''), aviso.length ? 9000 : 4000);
      Nav.ir('vAcervo');
    };
  },
  async una(z, g, reemplazar) {
    const avisos = [];
    const ahora = Date.now();
    const ruta = r => {
      if (r == null || r === '') return null;
      if (typeof r !== 'string' || r.startsWith('/') || r.includes('\\') ||
          r.split('/').some(x => !x || x === '.' || x === '..')) {
        throw new Error(t('El paquete contiene una ruta de archivo no válida.'));
      }
      return this.raiz + r;
    };

    if (G && G.id === g.id) throw new Error(t('No se puede reemplazar una grabación que está abierta.'));

    const reg = JSON.parse(JSON.stringify(g));
    Object.assign(reg, { estado: 'lista', respaldo: ahora, modificada: ahora, importada: ahora });
    const archivos = reg.archivos || {};
    const adjuntos = Array.isArray(reg.adjuntos) ? reg.adjuntos : [];
    delete reg.archivos;
    delete reg.adjuntos;
    reg.clips = (reg.clips || []).map(c => {
      const x = Object.assign({}, c);
      delete x.archivoWav;
      delete x.archivoOgg;
      return x;
    });

    const trozosNuevos = [];
    const adjuntosNuevos = [];
    let n = 0;
    let bytesArchivo = 0;
    let bytesConsulta = 0;

    if (archivos.archivo) {
      const w = await z.leer(ruta(archivos.archivo));
      const d = w && await pcmDeWav(w);
      if (d) {
        const frames = d.datos.size / (2 * d.ch);
        if (!Number.isSafeInteger(frames) || frames <= 0) throw new Error(t('El WAV importado tiene una duración inválida.'));
        trozosNuevos.push({
          grabacion: reg.id,
          tipo: 'archivo',
          n: ++n,
          datos: d.datos,
          frames,
          inicioFrame: 0
        });
        reg.tecnica.conArchivo = true;
        reg.tecnica.sr = d.sr;
        reg.tecnica.canales = d.ch;
        reg.frames = frames;
        reg.duracion = frames / d.sr;
        bytesArchivo = d.datos.size;
      } else {
        if (reemplazar) throw new Error(t('No se pudo leer el WAV del paquete; la grabación anterior se conserva.'));
        avisos.push(t('falta o no es compatible el WAV de «{titulo}»', { titulo: reg.ficha.titulo }));
        reg.tecnica.conArchivo = false;
        reg.frames = 0;
      }
    } else {
      reg.tecnica.conArchivo = false;
      reg.frames = 0;
    }

    if (archivos.consulta) {
      const c = await z.leer(ruta(archivos.consulta));
      if (c && c.size) {
        const mime = (reg.tecnica.mime || '').split(';')[0] || 'application/octet-stream';
        trozosNuevos.push({
          grabacion: reg.id,
          tipo: 'consulta',
          n: ++n,
          datos: new Blob([c], { type: mime }),
          frames: 0
        });
        reg.tecnica.conConsulta = true;
        bytesConsulta = c.size;
      } else {
        if (reemplazar) throw new Error(t('No se pudo leer el audio de consulta; la grabación anterior se conserva.'));
        avisos.push(t('falta la consulta de «{titulo}»', { titulo: reg.ficha.titulo }));
        reg.tecnica.conConsulta = false;
        reg.tecnica.mime = '';
      }
    } else {
      reg.tecnica.conConsulta = false;
      reg.tecnica.mime = '';
    }

    for (const a of adjuntos) {
      if (!a || typeof a.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(a.id)) {
        throw new Error(t('El paquete contiene un adjunto con código no válido.'));
      }
      if (!a.archivo) continue;
      const b = await z.leer(ruta(a.archivo));
      if (!b) {
        if (reemplazar) throw new Error(t('No se pudo leer el adjunto «{nombre}»; la grabación anterior se conserva.', { nombre: a.nombre || a.id }));
        avisos.push(t('falta el adjunto «{nombre}»', { nombre: a.nombre || a.id }));
        continue;
      }
      adjuntosNuevos.push({
        id: a.id,
        grabacion: reg.id,
        nombre: String(a.nombre || 'adjunto').slice(0, 240),
        tipo: String(a.tipo || '').slice(0, 160),
        tam: b.size,
        papel: a.papel || 'otro',
        nota: String(a.nota || '').slice(0, 4000),
        blob: new Blob([b], { type: a.tipo || '' }),
        fecha: a.fecha || ahora
      });
    }

    const sinIncluir = adjuntos.filter(a => !a.archivo).length + avisos.filter(x => String(x).includes('adjunto')).length;
    if (sinIncluir) {
      reg.eventos = (reg.eventos || []).concat([{
        t: 0,
        hora: horaBonita(Date.now()),
        tipo: t('importada'),
        detalle: t('{n} adjunto(s) no venían completos en el paquete', { n: sinIncluir })
      }]);
    }

    reg.bytes = { archivo: bytesArchivo, consulta: bytesConsulta };
    await DB.guardarImportacion(reg, trozosNuevos, adjuntosNuevos, !!reemplazar);
    return avisos;
  }
};

