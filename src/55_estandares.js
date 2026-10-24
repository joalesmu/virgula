/* ═════════════════ ESTÁNDARES PARA ARCHIVOS E INSTITUCIONES ═════════════════
   · Broadcast WAV (EBU Tech 3285): bloque «bext» + LIST/INFO dentro de cada WAV (fonotecas, archivos sonoros).
   · Dublin Core (OAI-DC): una ficha por grabación en XML (bibliotecas, repositorios, INAH, INALI).
   · Darwin Core (archivo DwC-A): ocurrencias para bases de biodiversidad (GBIF, CONABIO).
   · ELAN (.eaf): clips y transcripción alineados al audio (lingüística y documentación de lenguas).
   Los nombres de columnas y etiquetas de los estándares NO se traducen: así los leen los sistemas. */
const xml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
/** Valores de los campos propios que equivalen a un término de un estándar. */
function valoresEstandar(r, prefijo) {
  const p = Plantillas.de(r.ficha.plantilla && r.ficha.plantilla.id), out = {};
  p.campos.filter(c => !c.base && c.estandar && c.estandar.startsWith(prefijo + ':')).forEach(c => {
    let v = (r.ficha.extra || {})[c.id]; if (Plantillas.vacio(v)) return; if (Array.isArray(v)) v = v.join('; '); if (v === true) v = 'sí';
    const k = c.estandar.slice(prefijo.length + 1); out[k] = out[k] ? out[k] + ' | ' + v : String(v);
  });
  return out;
}
const textoPlano = s => String(s || '').replace(/\[([^\]\n]{1,200})\]\((adjunto:[\w-]+|https?:\/\/[^\s)]+)\)/g, '$1');

/* ── Broadcast WAV ── */
function metaWav(reg, desde = 0, titulo) {
  const f = reg.ficha, d = new Date(f.fechaHora || reg.creada), enc = new TextEncoder();
  const asc = (s, n) => { const b = new Uint8Array(n); const x = String(s || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\x20-\x7e]/g, '?').slice(0, n); for (let i = 0; i < x.length; i++) b[i] = x.charCodeAt(i); return b; };
  const historia = `A=PCM,F=${reg.tecnica.sr},W=16,M=${reg.tecnica.canales === 2 ? 'stereo' : 'mono'},T=Virgula ${VERSION}\r\n`;
  const tamB = 602 + historia.length + (historia.length % 2), bext = new Uint8Array(8 + tamB), v = new DataView(bext.buffer);
  bext.set([98, 101, 120, 116]); v.setUint32(4, tamB, true);
  bext.set(asc(textoPlano(titulo || f.titulo), 256), 8);
  bext.set(asc('Virgula', 32), 264); bext.set(asc(reg.id, 32), 296);
  bext.set(asc(`${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`, 10), 328); bext.set(asc(`${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`, 8), 338);
  const ref = Math.round(((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds() + desde) * reg.tecnica.sr);
  v.setUint32(346, ref % 0x100000000, true); v.setUint32(350, Math.floor(ref / 0x100000000), true); v.setUint16(354, 1, true);
  bext.set(asc(historia, historia.length), 610);
  // LIST/INFO en UTF-8 (lo leen la mayoría de los programas de audio)
  const campos = [['INAM', titulo || f.titulo], ['IART', f.quien], ['ICMT', textoPlano(f.descripcion).slice(0, 2000)], ['ICRD', (f.fechaHora || '').slice(0, 10)],
    ['ICOP', f.derechos], ['IKEY', f.claves], ['ISRC', reg.id], ['ISFT', 'Vírgula ' + VERSION]].filter(x => x[1]);
  const partes = campos.map(([id, txt]) => { const b = enc.encode(txt + '\0'), n = b.length, c = new Uint8Array(8 + n + (n % 2)), cv = new DataView(c.buffer); c.set([...id].map(x => x.charCodeAt(0))); cv.setUint32(4, n, true); c.set(b, 8); return c; });
  const tamL = 4 + partes.reduce((a, b) => a + b.length, 0), list = new Uint8Array(8 + tamL), lv = new DataView(list.buffer);
  list.set([76, 73, 83, 84]); lv.setUint32(4, tamL, true); list.set([73, 78, 70, 79], 8);
  let o = 12; partes.forEach(x => { list.set(x, o); o += x.length; });
  return [bext.buffer, list.buffer];
}

/* ── Dublin Core ── */
function dublinCore(grabaciones) {
  const e = (k, v) => v ? `    <dc:${k}>${xml(v)}</dc:${k}>\n` : '';
  const regs = grabaciones.map(r => {
    const f = r.ficha, u = f.ubicacion, x = valoresEstandar(r, 'dc'), c = f.consentimiento;
    return `  <oai_dc:dc>\n${e('identifier', r.id)}${e('title', f.titulo)}${e('creator', f.quien)}`
      + (f.confidencial ? '' : (f.participantes || []).filter(p => p.nombre).map(p => e('contributor', p.nombre + (p.rol ? ' (' + p.rol + ')' : ''))).join(''))
      + (x.contributor ? e('contributor', x.contributor) : '')
      + String(f.claves || '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => e('subject', s)).join('') + (x.subject ? e('subject', x.subject) : '')
      + e('description', textoPlano(f.descripcion)) + (x.description ? e('description', x.description) : '') + (f.transcripcion.texto ? e('description', 'Transcripción: ' + textoPlano(f.transcripcion.texto).slice(0, 4000)) : '')
      + e('date', f.fechaHora) + e('type', 'Sound') + (x.type ? e('type', x.type) : '') + e('format', r.archivos.archivo ? 'audio/wav' : (r.tecnica.mime || '').split(';')[0])
      + e('format', `${(r.duracion || 0).toFixed(1)} s`) + e('language', f.lenguas || f.transcripcion.lengua)
      + e('coverage', [f.lugar, u ? `${u.lat}, ${u.lon}` : ''].filter(Boolean).join(' · ')) + (x.coverage ? e('coverage', x.coverage) : '')
      + e('rights', [f.derechos, 'Consentimiento: ' + c.estado + (c.nota ? ' — ' + textoPlano(c.nota) : '')].filter(Boolean).join(' · '))
      + (f.fuentes || []).map(s => e('source', s.titulo + (s.enlace ? ' <' + s.enlace + '>' : ''))).join('') + (x.source ? e('source', x.source) : '')
      + (x.relation ? e('relation', x.relation) : '') + (r.adjuntos || []).filter(a => a.archivo).map(a => e('relation', a.archivo)).join('')
      + `  </oai_dc:dc>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Vírgula ${VERSION} · Dublin Core (OAI-DC), una ficha por grabación -->\n<grabaciones xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">\n${regs.join('\n')}\n</grabaciones>\n`;
}

/* ── Darwin Core ── */
const DWC_COLUMNAS = ['occurrenceID', 'basisOfRecord', 'eventDate', 'recordedBy', 'scientificName', 'vernacularName', 'individualCount', 'sex', 'lifeStage', 'behavior', 'habitat',
  'locality', 'decimalLatitude', 'decimalLongitude', 'geodeticDatum', 'coordinateUncertaintyInMeters', 'minimumElevationInMeters', 'maximumElevationInMeters',
  'samplingProtocol', 'eventRemarks', 'occurrenceRemarks', 'identificationRemarks', 'identifiedBy', 'associatedMedia', 'license', 'rightsHolder'];
const aplicaDarwin = r => r.ficha.uso === 'naturaleza' || Object.keys(valoresEstandar(r, 'dwc')).length > 0;
function darwinCore(grabaciones) {
  const filas = grabaciones.filter(aplicaDarwin).map(r => {
    const f = r.ficha, u = f.ubicacion, x = valoresEstandar(r, 'dwc');
    const inc = u ? (u.modo === 'exacta' ? Math.max(1, Math.round(u.precisionM || 30)) : u.modo === 'aprox1' ? 1600 : 16000) : '';
    const v = { occurrenceID: r.id, basisOfRecord: 'MachineObservation', eventDate: f.fechaHora, recordedBy: f.quien, locality: f.lugar,
      decimalLatitude: u ? u.lat : '', decimalLongitude: u ? u.lon : '', geodeticDatum: u ? 'WGS84' : '', coordinateUncertaintyInMeters: inc,
      minimumElevationInMeters: u && u.altitud != null ? u.altitud : '', maximumElevationInMeters: u && u.altitud != null ? u.altitud : '',
      occurrenceRemarks: textoPlano(f.descripcion), samplingProtocol: 'audio recording', associatedMedia: [r.archivos.archivo, r.archivos.consulta].filter(Boolean).join(' | '),
      license: f.derechos, rightsHolder: f.quien };
    Object.entries(x).forEach(([k, val]) => { if (DWC_COLUMNAS.includes(k)) v[k] = k === 'occurrenceRemarks' || k === 'samplingProtocol' ? [val, v[k]].filter(Boolean).join(' · ') : val; });
    return DWC_COLUMNAS.map(k => v[k]);
  });
  if (!filas.length) return null;
  const ocurrencias = csv([DWC_COLUMNAS, ...filas]).replace(/^﻿/, '');
  const meta = `<?xml version="1.0" encoding="UTF-8"?>\n<archive xmlns="http://rs.tdwg.org/dwc/text/">\n  <core encoding="UTF-8" fieldsTerminatedBy="," linesTerminatedBy="\\r\\n" fieldsEnclosedBy="&quot;" ignoreHeaderLines="1" rowType="http://rs.tdwg.org/dwc/terms/Occurrence">\n    <files><location>occurrence.csv</location></files>\n    <id index="0"/>\n`
    + DWC_COLUMNAS.map((k, i) => `    <field index="${i}" term="${k === 'license' || k === 'rightsHolder' ? 'http://purl.org/dc/terms/' : 'http://rs.tdwg.org/dwc/terms/'}${k}"/>`).join('\n') + `\n  </core>\n</archive>\n`;
  return { ocurrencias, meta, n: filas.length };
}

/* ── ELAN ── */
const tieneElan = r => (r.clips || []).some(c => !c.descartado) || !!r.ficha.transcripcion.texto;
function elan(r) {
  const medio = r.archivos.archivo || r.archivos.consulta, ms = s => Math.round(s * 1000), clips = (r.clips || []).filter(c => !c.descartado);
  // Las ranuras de tiempo van en orden creciente, como las espera ELAN
  const valores = new Set(); clips.forEach(c => { valores.add(ms(c.desde)); valores.add(ms(c.hasta)); }); if (r.ficha.transcripcion.texto) { valores.add(0); valores.add(ms(r.duracion)); }
  const tiempos = [...valores].sort((x, y) => x - y), ranura = v => 'ts' + (tiempos.indexOf(v) + 1);
  let n = 0;
  const capa = (id, l) => { const a = l.filter(x => x.v); return `  <TIER LINGUISTIC_TYPE_REF="default-lt" TIER_ID="${xml(id)}">\n${a.map(x => `    <ANNOTATION><ALIGNABLE_ANNOTATION ANNOTATION_ID="a${++n}" TIME_SLOT_REF1="${ranura(ms(x.d))}" TIME_SLOT_REF2="${ranura(ms(x.h))}"><ANNOTATION_VALUE>${xml(x.v)}</ANNOTATION_VALUE></ALIGNABLE_ANNOTATION></ANNOTATION>`).join('\n')}${a.length ? '\n' : ''}  </TIER>`; };
  const capas = [capa('Clips', clips.map(c => ({ d: c.desde, h: c.hasta, v: c.etiqueta || '#' + c.n }))), capa('Texto', clips.map(c => ({ d: c.desde, h: c.hasta, v: c.texto }))),
    capa('Traducción', clips.map(c => ({ d: c.desde, h: c.hasta, v: c.traduccion })))];
  if (r.ficha.transcripcion.texto) capas.push(capa('Transcripción completa', [{ d: 0, h: r.duracion, v: textoPlano(r.ficha.transcripcion.texto) }]));
  const orden = tiempos.map((v, i) => ({ v, id: 'ts' + (i + 1) }));
  const mime = /\.wav$/.test(medio || '') ? 'audio/x-wav' : /\.m4a$/.test(medio || '') ? 'audio/mp4' : 'audio/*';
  return `<?xml version="1.0" encoding="UTF-8"?>
<ANNOTATION_DOCUMENT AUTHOR="${xml(r.ficha.quien)}" DATE="${fechaISO(Date.now())}" FORMAT="3.0" VERSION="3.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.mpi.nl/tools/elan/EAFv3.0.xsd">
  <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds">
${medio ? `    <MEDIA_DESCRIPTOR MEDIA_URL="file:///${xml(encodeURI(medio))}" MIME_TYPE="${mime}" RELATIVE_MEDIA_URL="../${xml(encodeURI(medio))}"/>\n` : ''}    <PROPERTY NAME="lastUsedAnnotationId">${n}</PROPERTY>
  </HEADER>
  <TIME_ORDER>
${orden.map(x => `    <TIME_SLOT TIME_SLOT_ID="${x.id}" TIME_VALUE="${x.v}"/>`).join('\n')}
  </TIME_ORDER>
${capas.join('\n')}
  <LINGUISTIC_TYPE GRAPHIC_REFERENCES="false" LINGUISTIC_TYPE_ID="default-lt" TIME_ALIGNABLE="true"/>
  <CONSTRAINT DESCRIPTION="Time subdivision of parent annotation's time interval, no time gaps allowed within this interval" STEREOTYPE="Time_Subdivision"/>
  <CONSTRAINT DESCRIPTION="Symbolic subdivision of a parent annotation. Annotations refering to the same parent are ordered" STEREOTYPE="Symbolic_Subdivision"/>
  <CONSTRAINT DESCRIPTION="1-1 association with a parent annotation" STEREOTYPE="Symbolic_Association"/>
  <CONSTRAINT DESCRIPTION="Time alignable annotations within the parent annotation's time interval, gaps are allowed" STEREOTYPE="Included_In"/>
</ANNOTATION_DOCUMENT>
`;
}
