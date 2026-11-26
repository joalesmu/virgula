/* ═════════════════ LISTAS: preparación y guía de la grabación ═════════════════ */
const ListaTrabajo = {
  lista: [],
  actualId: '',
  seleccionGrabacion: '',
  borradorNuevo: false,
  hayCambiosSinGuardar() {
    const nombre = $('listaNombre'), tipo = $('listaTipo'), contenido = $('listaContenido');
    if (!nombre || !tipo || !contenido || !this.borradorNuevo && !this.actualId) return false;
    const texto = contenido.value;
    if (this.borradorNuevo) return !!(nombre.value.trim() || texto.trim());
    const original = this.lista.find(x => x.id === this.actualId);
    return !!original && (nombre.value !== original.nombre || tipo.value !== original.tipo || texto !== this.textoDe(original));
  },
  async cargar() {
    this.lista = await DB.todas('listas').catch(() => []);
    this.seleccionGrabacion = await DB.leer('ajustes', 'listaGrabacion').catch(() => '') || '';
    if (!this.lista.some(x => x.id === this.seleccionGrabacion)) this.seleccionGrabacion = '';
    this.actualId = this.seleccionGrabacion || (this.lista[0] && this.lista[0].id) || '';
    this.pintar();
    this.pintarGrabacion();
  },
  textoDe(l) {
    if (!l) return '';
    return l.tipo === 'guion' ? (l.texto || '') : (l.elementos || []).map(x => x.texto).join('\n');
  },
  normalizarElementos(texto) {
    return String(texto || '').split(/\r?\n/).map(x => x.trim().replace(/^\s*(?:(?:[-*•‣])\s+|\d+[.)]\s+)/, '').trim()).filter(Boolean).map(texto => ({ id: 'E' + Date.now().toString(36) + azar(4), texto }));
  },
  desdeTexto(nombre, tipo, texto, id) {
    const ahora = Date.now();
    return {
      id: id || 'L' + ahora.toString(36) + azar(5),
      nombre: String(nombre || '').trim().slice(0, 120),
      tipo: tipo === 'guion' ? 'guion' : 'elementos',
      texto: tipo === 'guion' ? String(texto || '') : '',
      elementos: tipo === 'guion' ? [] : this.normalizarElementos(texto),
      creada: ahora, modificada: ahora
    };
  },
  async obtener(id) { return this.lista.find(x => x.id === id) || await DB.leer('listas', id); },
  async instantaneaSeleccionada() {
    if (!this.seleccionGrabacion) return null;
    const l = await this.obtener(this.seleccionGrabacion);
    if (!l) throw new Error(t('La lista seleccionada ya no existe.'));
    return JSON.parse(JSON.stringify(l));
  },
  async seleccionarGrabacion(id) {
    if (G) return avisar(t('La lista de esta grabación ya quedó fijada. La selección cambiará para la siguiente grabación.'));
    this.seleccionGrabacion = id || '';
    await DB.poner('ajustes', this.seleccionGrabacion, 'listaGrabacion');
    this.pintarGrabacion();
  },
  opciones(id) {
    return `<option value="">${tH('Sin lista')}</option>` + this.lista.slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre))).map(l => `<option value="${esc(l.id)}" ${l.id === id ? 'selected' : ''}>${esc(l.nombre)} · ${l.tipo === 'guion' ? tH('Guion') : tH('{n} elementos', { n: (l.elementos || []).length })}</option>`).join('');
  },
  pintar() {
    const sel = $('listaSeleccion'), editor = $('listaEditor'), vacia = $('listaVacia');
    if (!sel || !editor) return;
    sel.innerHTML = this.opciones(this.actualId);
    sel.value = this.actualId;
    const l = this.lista.find(x => x.id === this.actualId);
    editor.classList.toggle('oculto', !l && !this.borradorNuevo);
    vacia.classList.toggle('oculto', !!l || this.borradorNuevo);
    if (l) {
      $('listaNombre').value = l.nombre;
      $('listaTipo').value = l.tipo;
      $('listaContenido').value = this.textoDe(l);
      $('bListaBorrar').classList.remove('oculto');
    } else if (this.borradorNuevo) {
      $('listaNombre').value = '';
      $('listaTipo').value = 'elementos';
      $('listaContenido').value = '';
      $('bListaBorrar').classList.add('oculto');
    }
    this.pintarAyuda();
    this.pintarGrabacion();
  },
  pintarAyuda() {
    const tipo = $('listaTipo') && $('listaTipo').value;
    if (!$('listaAyuda')) return;
    $('listaAyuda').textContent = tipo === 'guion'
      ? t('El guion se conserva como un solo texto, con sus párrafos y saltos de línea. No se asigna automáticamente a los clips.')
      : t('Cada salto de línea crea un elemento independiente. Se reconocen viñetas y numeraciones; las comas se conservan.');
    const texto = $('listaContenido') ? $('listaContenido').value : '';
    const n = tipo === 'guion' ? (texto.trim() ? 1 : 0) : this.normalizarElementos(texto).length;
    $('listaVistaPrevia').textContent = tipo === 'guion' ? (n ? t('Un guion de {n} carácter(es).', { n: texto.length }) : t('El guion está vacío.')) : t('{n} elemento(s) detectado(s).', { n });
  },
  pintarGrabacion() {
    const sel = $('listaGrabacion'), vista = $('listaLectura');
    if (!sel || !vista) return;
    const seleccion = G && G.listaTrabajo ? G.listaTrabajo.id : this.seleccionGrabacion;
    sel.innerHTML = this.opciones(seleccion);
    sel.value = seleccion || '';
    sel.disabled = !!G;
    $('bListaCrear').disabled = !!G;
    $('bListaImportar').disabled = !!G;
    const l = G ? G.listaTrabajo : this.lista.find(x => x.id === this.seleccionGrabacion);
    if (!l) { vista.classList.add('oculto'); vista.innerHTML = ''; return; }
    vista.classList.remove('oculto');
    if (l.tipo === 'guion') {
      vista.innerHTML = `<h3>${esc(l.nombre)}</h3><div class="lista-guion">${esc(l.texto || '')}</div>`;
      return;
    }
    const elementos = l.elementos || [];
    const indice = G ? indiceElementoLista(G.marcas) : 0;
    const actual = elementos[indice];
    const progreso = elementos.length ? tH('{n} de {total}', { n: Math.min(indice + 1, elementos.length), total: elementos.length }) : tH('Lista vacía');
    vista.innerHTML = `<div class="lista-actual" aria-live="polite"><div class="meta"><span>${esc(l.nombre)}</span><span>${progreso}</span></div><div class="valor">${actual ? esc(actual.texto) : tH('Lista completada')}</div></div>
      <ol class="lista-elementos">${elementos.map((x,i)=>`<li class="${i < indice ? 'completado' : i === indice ? 'actual' : ''}" ${i === indice ? 'aria-current="step"' : ''}>${esc(x.texto)} ${i < indice ? '✓' : ''}</li>`).join('')}</ol>`;
  },
  nuevo() {
    if (G) return avisar(t('Termina la grabación antes de crear o cambiar la lista de trabajo.'));
    this.actualId = '';
    this.borradorNuevo = true;
    this.pintar();
    Nav.ir('vListas');
    setTimeout(() => $('listaNombre') && $('listaNombre').focus(), 0);
  },
  async guardar() {
    const nombre = $('listaNombre').value.trim(), tipo = $('listaTipo').value, texto = $('listaContenido').value;
    if (!nombre) return avisar(t('La lista necesita un nombre.'));
    if (!texto.trim()) return avisar(t('La lista no puede estar vacía.'));
    const eraNueva = this.borradorNuevo;
    const anterior = this.lista.find(x => x.id === this.actualId);
    const nuevo = this.desdeTexto(nombre, tipo, texto, anterior && anterior.id);
    if (anterior) {
      nuevo.creada = anterior.creada;
      nuevo.modificada = Date.now();
      if (nuevo.tipo === 'elementos' && anterior.tipo === 'elementos') {
        const idsPorTexto = new Map();
        for (const elemento of (anterior.elementos || [])) {
          if (!idsPorTexto.has(elemento.texto)) idsPorTexto.set(elemento.texto, []);
          idsPorTexto.get(elemento.texto).push(elemento.id);
        }
        nuevo.elementos = nuevo.elementos.map(elemento => {
          const ids = idsPorTexto.get(elemento.texto);
          return ids && ids.length ? Object.assign({}, elemento, { id: ids.shift() }) : elemento;
        });
      }
    }
    if (this.lista.some(x => x.id !== nuevo.id && x.nombre.toLocaleLowerCase() === nombre.toLocaleLowerCase())) return avisar(t('Ya existe una lista con ese nombre.'));
    await DB.poner('listas', nuevo);
    this.lista = await DB.todas('listas');
    this.actualId = nuevo.id; this.borradorNuevo = false;
    if (eraNueva) { this.seleccionGrabacion = nuevo.id; await DB.poner('ajustes', nuevo.id, 'listaGrabacion'); }
    this.pintar();
    avisar(t('Lista «{nombre}» guardada.', { nombre }));
  },
  async borrar() {
    const l = this.lista.find(x => x.id === this.actualId); if (!l) return;
    if (!confirm(t('¿Borrar la lista «{nombre}»? Las grabaciones anteriores conservarán su copia.', { nombre: l.nombre }))) return;
    await DB.quitar('listas', l.id);
    this.lista = await DB.todas('listas');
    this.actualId = this.lista[0] ? this.lista[0].id : '';
    if (this.seleccionGrabacion === l.id) { this.seleccionGrabacion = ''; await DB.poner('ajustes', '', 'listaGrabacion'); }
    this.pintar();
  },
  async exportar() {
    const l = this.lista.find(x => x.id === this.actualId); if (!l) return;
    const f = new File([this.textoDe(l)], `${nombreArchivo(l.nombre, 80) || 'lista'}.txt`, { type: 'text/plain;charset=utf-8' });
    await descargarArchivos([f]);
  },
  async copiar() {
    const l = this.lista.find(x => x.id === this.actualId); if (!l) return;
    const texto = this.textoDe(l);
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); avisar(t('Texto de la lista copiado.')); }
      else window.prompt(t('Copia el texto de la lista:'), texto);
    } catch (_) { window.prompt(t('Copia el texto de la lista:'), texto); }
  },
  importarDialogo(textoInicial = '', nombreInicial = '') {
    Ventana.abrir(`<h2>${tH('📋 Importar o pegar lista')}</h2>
      <label for="impListaNombre">${tH('Nombre de la lista')}</label><input id="impListaNombre" type="text" maxlength="120" value="${esc(nombreInicial)}" placeholder="${tH('Ej. Vocabulario de alimentos')}">
      <label for="impListaTipo">${tH('Tipo')}</label><select id="impListaTipo"><option value="elementos">${tH('Elementos · un renglón por entrada')}</option><option value="guion">${tH('Guion · texto completo')}</option></select>
      <label for="impListaTexto">${tH('Pega aquí el texto')}</label><textarea id="impListaTexto" rows="12" maxlength="100000">${esc(textoInicial)}</textarea>
      <div class="fila"><button class="prim" id="impListaGuardar">${tH('Crear lista')}</button><button id="impListaCancelar">${tH('Cancelar')}</button></div>`);
    $('impListaCancelar').onclick = () => Ventana.cerrar();
    $('impListaGuardar').onclick = async () => {
      const nombre = $('impListaNombre').value.trim(), tipo = $('impListaTipo').value, texto = $('impListaTexto').value;
      if (!nombre || !texto.trim()) return avisar(t('Escribe un nombre y pega el contenido de la lista.'));
      const nuevo = this.desdeTexto(nombre, tipo, texto);
      if (this.lista.some(x => x.nombre.toLowerCase() === nombre.toLowerCase())) nuevo.nombre += ' (importada)';
      await DB.poner('listas', nuevo);
      this.lista = await DB.todas('listas'); this.actualId = nuevo.id; this.borradorNuevo = false;
      this.seleccionGrabacion = nuevo.id; await DB.poner('ajustes', nuevo.id, 'listaGrabacion');
      Ventana.cerrar(); this.pintar(); avisar(t('Lista «{nombre}» importada.', { nombre: nuevo.nombre }));
    };
  },
  async incorporar(l) {
    if (!l || typeof l.id !== 'string' || !['elementos','guion'].includes(l.tipo) || typeof l.nombre !== 'string') return;
    const nombre = l.nombre.trim().slice(0, 120);
    if (!nombre) return;
    let copia;
    if (l.tipo === 'guion') {
      if (typeof l.texto !== 'string' || l.texto.length > 100000) return;
      copia = { id: l.id, nombre, tipo: 'guion', texto: l.texto, elementos: [] };
    } else {
      if (!Array.isArray(l.elementos) || l.elementos.length > 5000) return;
      const elementos = [];
      for (const x of l.elementos) {
        if (!x || typeof x.texto !== 'string' || !x.texto.trim() || x.texto.length > 2000) return;
        elementos.push({ id: typeof x.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(x.id) ? x.id : 'E' + azar(8), texto: x.texto.trim() });
      }
      copia = { id: l.id, nombre, tipo: 'elementos', texto: '', elementos };
    }
    const mismoContenido = this.lista.find(x =>
      x.tipo === copia.tipo &&
      x.nombre === copia.nombre &&
      this.textoDe(x) === this.textoDe(copia)
    );
    if (mismoContenido) return;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(copia.id)) copia.id = 'L' + Date.now().toString(36) + azar(5);
    if (this.lista.some(x => x.id === copia.id)) copia.id = 'L' + Date.now().toString(36) + azar(5);
    copia.creada = Date.now(); copia.modificada = Date.now();
    await DB.poner('listas', copia);
    this.lista = await DB.todas('listas');
  }
};
$('listaSeleccion').addEventListener('change', e => {
  const id = e.target.value;
  const anterior = ListaTrabajo.lista.find(x => x.id === ListaTrabajo.actualId);
  const contenidoActual = $('listaContenido').value;
  const cambios = ListaTrabajo.borradorNuevo
    ? !!($('listaNombre').value.trim() || contenidoActual.trim())
    : !!anterior && ($('listaNombre').value !== anterior.nombre || $('listaTipo').value !== anterior.tipo || contenidoActual !== ListaTrabajo.textoDe(anterior));
  if (cambios && !confirm(t('Hay cambios sin guardar. ¿Descartarlos y abrir otra lista?'))) { e.target.value = ListaTrabajo.actualId; return; }
  ListaTrabajo.actualId = id; ListaTrabajo.borradorNuevo = false; ListaTrabajo.pintar();
});
$('listaTipo').addEventListener('change', () => ListaTrabajo.pintarAyuda());
$('listaContenido').addEventListener('input', () => ListaTrabajo.pintarAyuda());
$('bListaNueva').onclick = () => ListaTrabajo.nuevo();
$('bListaCrear').onclick = () => ListaTrabajo.nuevo();
$('bListaGuardar').onclick = () => ListaTrabajo.guardar();
$('bListaBorrar').onclick = () => ListaTrabajo.borrar();
$('bListaExportar').onclick = () => ListaTrabajo.exportar();
$('bListaCopiar').onclick = () => ListaTrabajo.copiar();
$('bListaPegar').onclick = () => ListaTrabajo.importarDialogo();
$('bListaImportar').onclick = () => ListaTrabajo.importarDialogo();
$('bListaArchivo').onclick = () => $('archivoLista').click();
$('archivoLista').onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { ListaTrabajo.importarDialogo(await f.text(), f.name.replace(/\.txt$/i, '')); }
  catch (err) { avisar(t('No se pudo leer el archivo: {error}', { error: err.message })); }
};
$('listaGrabacion').addEventListener('change', e => ListaTrabajo.seleccionarGrabacion(e.target.value));
$('bComprobarActualizaciones').onclick = () => comprobarActualizaciones(true);

