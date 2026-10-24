/* ═════════════════ ACERVO: todas las grabaciones del aparato ═════════════════ */
const sinAcentos = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const Acervo = {
  sel: new Set(), q: '',
  async lista() { return (await DB.todas('grabaciones')).filter(r => r.estado === 'lista').sort((a, b) => b.creada - a.creada); },
  texto(r) {
    const f = r.ficha, extra = Object.values(f.extra || {}).map(v => Array.isArray(v) ? v.join(' ') : typeof v === 'string' ? v : '');
    return sinAcentos([f.titulo, f.descripcion, f.lugar, f.lenguas, f.claves, f.notas, f.transcripcion.texto, ...(f.traducciones || []).map(x => x.texto),
      ...(f.participantes || []).map(p => p.nombre), ...(r.clips || []).map(c => c.etiqueta + ' ' + c.texto + ' ' + c.traduccion), ...extra, r.id].join(' '));
  },
  sinRespaldo: r => !r.respaldo || r.modificada > r.respaldo,
  async pintar() {
    const todas = await this.lista(), q = sinAcentos(this.q).trim();
    const lista = q ? todas.filter(r => this.texto(r).includes(q)) : todas;
    const sinResp = todas.filter(this.sinRespaldo);
    $('avisoRespaldo').innerHTML = sinResp.length
      ? `<div class="banda aviso">${tH('💾 {n} grabación(es) sin respaldo o con cambios desde el último. Selecciónalas y usa 📦 Exportar para guardarlas en Drive, en otra computadora o donde prefieras.', { n: sinResp.length })}
         <div class="fila fija"><button class="chico" id="bElegirSinResp">${tH('☑ Elegir las que faltan')}</button></div></div>`
      : (todas.length ? `<div class="banda ok">${tH('✅ Todo respaldado.')}</div>` : '');
    if ($('bElegirSinResp')) $('bElegirSinResp').onclick = () => { this.sel = new Set(sinResp.map(r => r.id)); this.pintar(); };
    const adj = {}; (await DB.todas('adjuntos')).forEach(a => { adj[a.grabacion] = (adj[a.grabacion] || 0) + 1; });
    $('lista').innerHTML = lista.length ? lista.map(r => {
      const f = r.ficha, c = f.consentimiento.estado, clips = (r.clips || []).filter(x => !x.descartado).length, faltan = Plantillas.faltan(r).filter(x => x !== t('Consentimiento')).length;
      return `<div class="tarjeta"><input type="checkbox" data-sel="${r.id}" ${this.sel.has(r.id) ? 'checked' : ''} aria-label="${tH('Elegir {titulo}', { titulo: f.titulo })}">
        <div class="cuerpo" data-abrir="${r.id}"><h3>${esc(f.titulo)}</h3>
        <div class="nota">${fechaBonita(r.creada)} · ${reloj(r.duracion)}${f.lugar ? ' · ' + esc(f.lugar) : ''} · 🧩 ${esc(Plantillas.nombre(Plantillas.de(f.plantilla && f.plantilla.id)))}</div>
        <div>${chip(c === 'otorgado' ? tH('✔ consentimiento') : c === 'no aplica' ? tH('consentimiento no aplica') : tH('⏳ consentimiento pendiente'), c === 'pendiente' ? 'aviso' : 'ok')}
        ${faltan ? chip(tH('📝 faltan {n} dato(s)', { n: faltan }), 'aviso') : ''}
        ${clips ? chip(tH('🔖 {n} clip(s)', { n: clips })) : ''}${adj[r.id] ? chip('📎 ' + adj[r.id]) : ''}${f.transcripcion.texto ? chip(tH('✍️ transcripción')) : ''}${(f.traducciones || []).length ? chip(tH('🌐 {n} traducción(es)', { n: f.traducciones.length })) : ''}
        ${f.confidencial ? chip(tH('🔒 confidencial'), 'aviso') : ''}${r.recuperada ? chip(tH('🛟 recuperada'), 'aviso') : ''}${this.sinRespaldo(r) ? chip(tH('💾 sin respaldo'), 'aviso') : ''}</div></div></div>`;
    }).join('') : `<p class="nota">${todas.length ? tH('Nada coincide con la búsqueda.') : tH('Todavía no hay grabaciones. Ve a ⏺ Grabar.')}</p>`;
    this.contar();
  },
  contar() { $('nSel').textContent = this.sel.size; $('bExportarSel').disabled = !this.sel.size; }
};
$('lista').addEventListener('click', e => {
  const s = e.target.closest('[data-sel]'); if (s) { s.checked ? Acervo.sel.add(s.dataset.sel) : Acervo.sel.delete(s.dataset.sel); Acervo.contar(); return; }
  const a = e.target.closest('[data-abrir]'); if (a) Ficha.abrir(a.dataset.abrir);
});
$('buscar').addEventListener('input', () => { Acervo.q = $('buscar').value; clearTimeout(Acervo._t); Acervo._t = setTimeout(() => Acervo.pintar(), 250); });
$('bTodas').onclick = async () => { const l = await Acervo.lista(); if (Acervo.sel.size === l.length) Acervo.sel.clear(); else l.forEach(r => Acervo.sel.add(r.id)); Acervo.pintar(); };
$('bExportarSel').onclick = () => Exportar.abrir([...Acervo.sel]);
$('bImportar').onclick = () => $('archivoImportar').click();
$('archivoImportar').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) Importar.paquete(f); };

/* ─────────── Recordatorio de respaldo ─────────── */
const Recordatorio = {
  async revisar() {
    const d = $('avisoGlobal'), dias = Ajustes.v.diasRespaldo; d.innerHTML = '';
    if (!dias || G || Date.now() < (Ajustes.v.recordarDesde || 0)) return;
    const limite = Date.now() - dias * 86400000, viejas = (await Acervo.lista()).filter(r => Acervo.sinRespaldo(r) && Math.max(r.creada, r.respaldo || 0) < limite);
    if (!viejas.length) return;
    d.innerHTML = `<div class="banda aviso" role="status">${tH('💾 {n} grabación(es) llevan más de {d} día(s) sin respaldo. Solo existen en este aparato.', { n: viejas.length, d: dias })}
      <div class="fila fija"><button class="chico prim" id="bRespaldarYa">${tH('📦 Respaldar ahora')}</button><button class="chico" id="bRecordarManana">${tH('Mañana')}</button></div></div>`;
    $('bRespaldarYa').onclick = async () => { d.innerHTML = ''; Acervo.sel = new Set(viejas.map(r => r.id)); Nav.ir('vAcervo'); await Exportar.abrir([...Acervo.sel]); };
    $('bRecordarManana').onclick = async () => { Ajustes.v.recordarDesde = Date.now() + 86400000; await Ajustes.guardar(); d.innerHTML = ''; };
  }
};
