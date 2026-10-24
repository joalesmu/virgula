/* ═════════════════ IMPORTAR: un paquete .zip de Vírgula (propio o de otra persona) ═════════════════ */
async function leerZip(file) {
  const cola = Math.min(file.size, 65557), fin = new DataView(await file.slice(file.size - cola).arrayBuffer());
  let p = -1; for (let i = cola - 22; i >= 0; i--) if (fin.getUint32(i, true) === 0x06054b50) { p = i; break; }
  if (p < 0) throw new Error('No parece un archivo .zip.');
  const n = fin.getUint16(p + 10, true), tam = fin.getUint32(p + 12, true), ini = fin.getUint32(p + 16, true);
  if (ini === 0xffffffff) throw new Error('Este .zip es de más de 4 GB (zip64); Vírgula aún no lo lee.');
  const cd = new DataView(await file.slice(ini, ini + tam).arrayBuffer()), dec = new TextDecoder(), entradas = {};
  for (let i = 0, o = 0; i < n; i++) {
    if (cd.getUint32(o, true) !== 0x02014b50) throw new Error('El .zip está dañado.');
    const metodo = cd.getUint16(o + 10, true), comp = cd.getUint32(o + 20, true), real = cd.getUint32(o + 24, true),
      ln = cd.getUint16(o + 28, true), le = cd.getUint16(o + 30, true), lc = cd.getUint16(o + 32, true), loc = cd.getUint32(o + 42, true);
    const nombre = dec.decode(new Uint8Array(cd.buffer, o + 46, ln));
    if (!nombre.endsWith('/')) entradas[nombre] = { metodo, comp, real, loc };
    o += 46 + ln + le + lc;
  }
  const leer = async ruta => {
    const e = entradas[ruta]; if (!e) return null;
    const h = new DataView(await file.slice(e.loc, e.loc + 30).arrayBuffer()), datos = e.loc + 30 + h.getUint16(26, true) + h.getUint16(28, true);
    const b = file.slice(datos, datos + e.comp);
    if (e.metodo === 0) return b;
    if (e.metodo === 8) { if (!window.DecompressionStream) throw new Error('Este navegador no descomprime .zip.'); return new Response(b.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob(); }
    throw new Error('Compresión no reconocida en ' + ruta);
  };
  return { rutas: Object.keys(entradas), leer };
}
/** Quita la cabecera de un WAV (busca el bloque «data»; no da por hecho 44 bytes). */
async function pcmDeWav(blob) {
  const h = new DataView(await blob.slice(0, Math.min(blob.size, 4096)).arrayBuffer()), t = (o) => String.fromCharCode(h.getUint8(o), h.getUint8(o + 1), h.getUint8(o + 2), h.getUint8(o + 3));
  if (t(0) !== 'RIFF' || t(8) !== 'WAVE') return null;
  let o = 12, info = {};
  while (o + 8 <= h.byteLength) {
    const id = t(o), n = h.getUint32(o + 4, true);
    if (id === 'fmt ') info = { ch: h.getUint16(o + 10, true), sr: h.getUint32(o + 12, true), bits: h.getUint16(o + 22, true) };
    if (id === 'data') return Object.assign(info, { datos: blob.slice(o + 8, Math.min(blob.size, o + 8 + n)) });
    o += 8 + n + (n & 1);
  }
  return null;
}

const Importar = {
  async paquete(file) {
    avisar('📥 Leyendo el paquete…');
    let z, p;
    try {
      z = await leerZip(file);
      const rj = z.rutas.find(r => /(^|\/)fichas\.json$/.test(r)); if (!rj) throw new Error('El paquete no tiene fichas.json: no es un paquete de Vírgula.');
      this.raiz = rj.slice(0, -'fichas.json'.length);
      p = JSON.parse(await (await z.leer(rj)).text());
      if (!p || !/^virgula-paquete-/.test(p.formato) || !Array.isArray(p.grabaciones)) throw new Error('fichas.json no tiene el formato de Vírgula.');
    } catch (e) { return avisar('⚠️ ' + e.message, 6000); }
    const ya = [];
    for (const g of p.grabaciones) if (await DB.leer('grabaciones', g.id)) ya.push(g);
    const nuevas = p.grabaciones.length - ya.length;
    Ventana.abrir(`<h2>📥 Importar paquete</h2>
      <p>${esc(file.name)} · ${mb(file.size)}<br>${p.grabaciones.length} grabación(es) · exportado el ${esc(String(p.exportado || '').replace('T', ' '))}</p>
      <ul>${p.grabaciones.slice(0, 12).map(g => `<li>${esc(g.ficha.titulo)} · ${reloj(g.duracion)}${ya.includes(g) ? ' <span class="chip aviso">ya está</span>' : ''}</li>`).join('')}${p.grabaciones.length > 12 ? '<li>…</li>' : ''}</ul>
      ${ya.length ? `<div class="op"><label><input type="radio" name="iYa" value="saltar" checked> Dejar como están las ${ya.length} que ya tengo</label><label><input type="radio" name="iYa" value="reemplazar"> Reemplazarlas con las del paquete</label></div>` : ''}
      <p class="nota" id="iProg"></p>
      <div class="fila"><button class="prim" id="iOk" ${!nuevas && !ya.length ? 'disabled' : ''}>📥 Importar</button><button id="iNo">Cancelar</button></div>`);
    $('iNo').onclick = () => Ventana.cerrar();
    $('iOk').onclick = async () => {
      const reemplazar = leerRadio('iYa') === 'reemplazar'; $('iOk').disabled = true;
      let n = 0, aviso = [];
      for (const g of p.grabaciones) {
        if (ya.includes(g) && !reemplazar) continue;
        $('iProg').textContent = `Importando «${g.ficha.titulo}»…`;
        try { aviso.push(...await this.una(z, g, ya.includes(g))); n++; } catch (e) { aviso.push(`«${g.ficha.titulo}»: ${e.message}`); }
      }
      Ventana.cerrar();
      avisar(`📥 ${n} grabación(es) importada(s).${aviso.length ? ' ⚠️ ' + aviso.join(' · ') : ''}`, aviso.length ? 9000 : 4000);
      Nav.ir('vAcervo');
    };
  },
  async una(z, g, reemplazar) {
    const avisos = [], ruta = r => r ? this.raiz + r : null, ahora = Date.now();
    if (reemplazar) await DB.borrarGrabacion(g.id);
    const reg = Object.assign({}, g, { estado: 'lista', respaldo: ahora, modificada: ahora, importada: ahora });
    const archivos = reg.archivos || {}, adjuntos = reg.adjuntos || [];
    delete reg.archivos; delete reg.adjuntos;
    reg.clips = (reg.clips || []).map(c => { const x = Object.assign({}, c); delete x.archivoWav; delete x.archivoOgg; return x; });
    let n = 0;
    if (archivos.archivo) {
      const w = await z.leer(ruta(archivos.archivo)), d = w && await pcmDeWav(w);
      if (d) { await DB.poner('trozos', { grabacion: reg.id, tipo: 'archivo', n: ++n, datos: d.datos, frames: d.datos.size / (2 * d.ch) }); reg.tecnica.conArchivo = true; reg.tecnica.sr = d.sr; reg.tecnica.canales = d.ch; }
      else avisos.push(`falta el WAV de «${reg.ficha.titulo}»`);
    } else reg.tecnica.conArchivo = false;
    if (archivos.consulta) {
      const c = await z.leer(ruta(archivos.consulta));
      if (c) await DB.poner('trozos', { grabacion: reg.id, tipo: 'consulta', n: ++n, datos: new Blob([c], { type: (reg.tecnica.mime || '').split(';')[0] }), frames: 0 });
      else avisos.push(`falta la consulta de «${reg.ficha.titulo}»`);
    } else reg.tecnica.mime = '';
    for (const a of adjuntos) {
      if (!a.archivo) continue;   // no venía en el paquete
      const b = await z.leer(ruta(a.archivo));
      if (!b) { avisos.push(`falta el adjunto «${a.nombre}»`); continue; }
      await DB.poner('adjuntos', { id: a.id, grabacion: reg.id, nombre: a.nombre, tipo: a.tipo || '', tam: b.size, papel: a.papel || 'otro', nota: a.nota || '', blob: new Blob([b], { type: a.tipo || '' }), fecha: a.fecha || ahora });
    }
    const sinIncluir = adjuntos.filter(a => !a.archivo).length;
    if (sinIncluir) reg.eventos = (reg.eventos || []).concat([{ t: 0, hora: new Date().toLocaleTimeString('es-MX'), tipo: 'importada', detalle: `${sinIncluir} adjunto(s) no venían en el paquete` }]);
    await DB.poner('grabaciones', reg);
    return avisos;
  }
};
