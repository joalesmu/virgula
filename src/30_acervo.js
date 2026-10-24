/* ═════════════════ ACERVO: todas las grabaciones del aparato ═════════════════ */
const Acervo = {
  sel: new Set(), q: '',
  async lista() { return (await DB.todas('grabaciones')).filter(r => r.estado === 'lista').sort((a, b) => b.creada - a.creada); },
  texto(r) { const f = r.ficha; return [f.titulo, f.descripcion, f.lugar, f.lenguas, f.claves, f.notas, f.transcripcion.texto, ...(f.traducciones || []).map(t => t.texto), ...(f.participantes || []).map(p => p.nombre), ...(r.clips || []).map(c => c.etiqueta + ' ' + c.texto), r.id].join(' ').toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''); },
  async pintar() {
    const todas = await this.lista(), q = this.q.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
    const lista = q ? todas.filter(r => this.texto(r).includes(q)) : todas;
    const sinResp = todas.filter(r => !r.respaldo || r.modificada > r.respaldo);
    $('avisoRespaldo').innerHTML = sinResp.length ? `<div class="banda aviso">💾 ${sinResp.length} grabación(es) sin respaldo o con cambios desde el último. Selecciónalas y usa 📦 Exportar para guardarlas en Drive, en otra computadora o donde prefieras.</div>` : (todas.length ? '<div class="banda ok">✅ Todo respaldado.</div>' : '');
    const adj = {}; (await DB.todas('adjuntos')).forEach(a => { adj[a.grabacion] = (adj[a.grabacion] || 0) + 1; });
    $('lista').innerHTML = lista.length ? lista.map(r => {
      const f = r.ficha, c = f.consentimiento.estado, clips = (r.clips || []).filter(x => !x.descartado).length;
      return `<div class="tarjeta"><input type="checkbox" data-sel="${r.id}" ${this.sel.has(r.id) ? 'checked' : ''} aria-label="Elegir ${esc(f.titulo)}">
        <div class="cuerpo" data-abrir="${r.id}"><h3>${esc(f.titulo)}</h3>
        <div class="nota">${fechaBonita(r.creada)} · ${reloj(r.duracion)}${f.lugar ? ' · ' + esc(f.lugar) : ''}</div>
        <div>${chip(c === 'otorgado' ? '✔ consentimiento' : c === 'no aplica' ? 'consentimiento no aplica' : '⏳ consentimiento pendiente', c === 'pendiente' ? 'aviso' : 'ok')}
        ${clips ? chip('🔖 ' + clips + ' clip(s)') : ''}${adj[r.id] ? chip('📎 ' + adj[r.id]) : ''}${f.transcripcion.texto ? chip('✍️ transcripción') : ''}${(f.traducciones || []).length ? chip('🌐 ' + f.traducciones.length + ' traducción(es)') : ''}
        ${f.confidencial ? chip('🔒 confidencial', 'aviso') : ''}${r.recuperada ? chip('🛟 recuperada', 'aviso') : ''}${!r.respaldo || r.modificada > r.respaldo ? chip('💾 sin respaldo', 'aviso') : ''}</div></div></div>`;
    }).join('') : `<p class="nota">${todas.length ? 'Nada coincide con la búsqueda.' : 'Todavía no hay grabaciones. Ve a ⏺ Grabar.'}</p>`;
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
