/* ============================================================
   Pestaña Papeles: el seguro del auto, el contrato de alquiler, el DNI…
   que se encuentren desde la app, incluso sin señal.

   El registro (título, tipo, vencimiento, nota) viaja como los
   movimientos. El ARCHIVO (foto o PDF) se guarda:
   · en este teléfono, en IndexedDB (localStorage no aguanta archivos);
   · y, si está conectada la planilla, en una carpeta de Drive del hogar,
     de donde el otro teléfono lo baja la primera vez que lo abre.
   Las fotos se achican antes de guardar (lado mayor 2000 px): una foto de
   celular pesa 4–8 MB y así queda en ~400 KB, legible igual.
   ============================================================ */

const MAX_ARCHIVO = 15 * 1024 * 1024;

/* ---------- IndexedDB: los archivos de este teléfono ---------- */
let _idb = null;
function idb() {
  if (_idb) return _idb;
  _idb = new Promise((ok, mal) => {
    const r = indexedDB.open('hogar', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('archivos');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  return _idb;
}
async function archivoGuardar(id, blob) {
  const d = await idb();
  return new Promise((ok, mal) => {
    const t = d.transaction('archivos', 'readwrite');
    t.objectStore('archivos').put(blob, id);
    t.oncomplete = ok; t.onerror = () => mal(t.error);
  });
}
async function archivoLeer(id) {
  const d = await idb();
  return new Promise(ok => {
    const r = d.transaction('archivos').objectStore('archivos').get(id);
    r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null);
  });
}
async function archivoBorrar(id) {
  const d = await idb();
  d.transaction('archivos', 'readwrite').objectStore('archivos').delete(id);
}
async function idsConArchivo() {
  const d = await idb();
  return new Promise(ok => {
    const r = d.transaction('archivos').objectStore('archivos').getAllKeys();
    r.onsuccess = () => ok(new Set(r.result)); r.onerror = () => ok(new Set());
  });
}

/* ---------- Consultas ---------- */
function papelesPorVencer(dias) {
  return vivos(db.papeles).filter(p => p.vence && diasHasta(p.vence) <= dias)
    .sort((a, b) => a.vence.localeCompare(b.vence));
}
const tipoPapel = id => TIPOS_PAPEL.find(t => t.id === id) || TIPOS_PAPEL[TIPOS_PAPEL.length - 1];

/* ---------- Pantalla ---------- */
function initPapeles() {
  $('#p-texto').addEventListener('input', pintarPapeles);
  $('#p-nuevo').addEventListener('click', () => formPapel());
  $('#p-descargas').addEventListener('click', copiasADescargas);
}

/* Le pide al teléfono que la memoria de la app sea "persistente": sin
   esto, Android puede borrarla cuando le falta lugar, y con ella los
   papeles guardados. Chrome lo concede solo a apps instaladas o muy usadas,
   así que se vuelve a pedir en cada arranque. */
async function pedirMemoriaPersistente() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch (e) {}
}

async function pintarEstadoGuardado(lista, locales) {
  const conArchivo = lista.filter(p => p.mime);
  $('#p-guardado').classList.toggle('hidden', !conArchivo.length);
  if (!conArchivo.length) return;
  const aca = conArchivo.filter(p => locales.has(p.id)).length;
  let fija = false;
  try { fija = navigator.storage && await navigator.storage.persisted(); } catch (e) {}
  $('#p-estado').innerHTML = (aca === conArchivo.length
    ? (aca === 1 ? '✓ El archivo está guardado' : `✓ Los ${aca} archivos están guardados`) + ' en este teléfono: se abren sin señal.'
    : `${aca} de ${conArchivo.length} archivos en este teléfono. Los otros se bajan solos la próxima vez que haya señal.`) +
    (fija ? '' : '<br>Para que el teléfono no los borre si se queda sin lugar, instalen la app ("Agregar a pantalla de inicio").');
}

async function copiasADescargas() {
  const locales = await idsConArchivo();
  const lista = vivos(db.papeles).filter(p => p.mime && locales.has(p.id));
  if (!lista.length) { toast('No hay archivos guardados en este teléfono'); return; }
  toast(`Guardando ${lista.length} archivos en Descargas…`);
  for (const p of lista) {
    const blob = await archivoLeer(p.id);
    const ext = (p.nombreArchivo || '').match(/\.\w+$/) ? '' : (p.mime === 'application/pdf' ? '.pdf' : '.jpg');
    descargar(`HOGAR - ${p.titulo}${ext}`.replace(/[\\/:*?"<>|]/g, '-'), blob);
    await new Promise(r => setTimeout(r, 700));   // de a uno: varios juntos el navegador los frena
  }
}

async function pintarPapeles() {
  const texto = $('#p-texto').value.trim().toLowerCase();
  const locales = await idsConArchivo();
  const lista = vivos(db.papeles).filter(p => !texto ||
    [p.titulo, p.nota, tipoPapel(p.tipo).nombre, p.nombreArchivo].join(' ').toLowerCase().includes(texto));
  pintarEstadoGuardado(vivos(db.papeles), locales);

  const pronto = papelesPorVencer(45);
  $('#p-vencen').innerHTML = pronto.length && !texto ? `<div class="card"><h2>Vencimientos</h2>${pronto.map(p => {
    const d = diasHasta(p.vence);
    return `<div class="aviso ${d < 0 ? 'aviso-mal' : ''}">${tipoPapel(p.tipo).emoji} <b>${esc(p.titulo)}</b>
      ${d < 0 ? 'venció hace ' + -d + ' días' : d === 0 ? 'vence hoy' : 'vence en ' + d + (d === 1 ? ' día' : ' días')} · ${fmtFecha(p.vence)}</div>`;
  }).join('')}</div>` : '';

  if (!lista.length) {
    $('#p-lista').innerHTML = `<div class="card">${vacio(texto ? 'No hay papeles con ese nombre.'
      : 'Guarden acá la póliza del seguro, la cédula del auto, el contrato de alquiler… Con fecha de vencimiento, la app avisa antes.')}</div>`;
    return;
  }
  const porTipo = {};
  lista.forEach(p => (porTipo[p.tipo] = porTipo[p.tipo] || []).push(p));
  $('#p-lista').innerHTML = TIPOS_PAPEL.filter(t => porTipo[t.id]).map(t => `
    <div class="card"><h2>${t.emoji} ${t.nombre}</h2><div class="lista">
    ${porTipo[t.id].sort((a, b) => a.titulo.localeCompare(b.titulo)).map(p => {
      const enTel = locales.has(p.id), enDrive = !!p.driveId;
      const d = p.vence ? diasHasta(p.vence) : null;
      return `<button class="mov papel" data-id="${p.id}">
        <span class="mov-ico">${p.mime && p.mime.startsWith('image/') ? '🖼' : p.mime ? '📄' : '📝'}</span>
        <span class="mov-txt"><b>${esc(p.titulo)}</b>
          <small>${p.vence ? `<span class="${d < 0 ? 'neg' : d <= 30 ? 'gasto' : ''}">vence ${fmtFecha(p.vence)}</span> · ` : ''}${esc(p.nota || '')}</small></span>
        <span class="papel-estado" title="${enTel ? 'Guardado en este teléfono' : enDrive ? 'En Drive: se baja al abrirlo' : 'Sin archivo'}">
          ${p.mime ? (enTel ? '📱' : enDrive ? '☁' : '⚠') : ''}${p.mime && !enDrive && db.local.url ? '<small>sin subir</small>' : ''}</span>
      </button>`;
    }).join('')}</div></div>`).join('');
  $$('#p-lista .papel').forEach(b => b.addEventListener('click', () => verPapel(b.dataset.id)));
}

/* ---------- Ver un papel ---------- */
async function verPapel(id) {
  const p = db.papeles.find(x => x.id === id);
  if (!p) return;
  abrirModal(`<h2>${tipoPapel(p.tipo).emoji} ${esc(p.titulo)}</h2>
    ${p.vence ? `<p>Vence: <b>${fmtFecha(p.vence)}</b></p>` : ''}
    ${p.nota ? `<p class="nota-papel">${esc(p.nota).replace(/\n/g, '<br>')}</p>` : ''}
    <div id="visor" class="visor">${p.mime ? '<p class="hint">Buscando el archivo…</p>' : ''}</div>
    <div class="row">
      <button class="btn btn-sec" id="pv-editar">Editar</button>
      <button class="btn btn-sec" id="pv-cerrar">Cerrar</button>
    </div>`);
  $('#pv-cerrar').addEventListener('click', cerrarModal);
  $('#pv-editar').addEventListener('click', () => formPapel(p));
  if (!p.mime) return;

  let blob = await archivoLeer(p.id);
  if (!blob && p.driveId && db.local.url) {
    $('#visor').innerHTML = '<p class="hint">Bajando de Drive…</p>';
    try { blob = await bajarArchivo(p); await archivoGuardar(p.id, blob); }
    catch (e) { $('#visor').innerHTML = `<p class="aviso aviso-mal">No se pudo bajar: ${esc(e.message)}. ¿Hay señal?</p>`; return; }
  }
  if (!blob) {
    $('#visor').innerHTML = `<p class="aviso">El archivo quedó en el otro teléfono y todavía no se subió a Drive.</p>`;
    return;
  }
  const url = URL.createObjectURL(blob);
  $('#visor').innerHTML = (p.mime.startsWith('image/') ? `<img src="${url}" alt="${esc(p.titulo)}">` : '') +
    `<div class="row"><a class="btn" href="${url}" target="_blank" rel="noopener">Abrir</a>
     <a class="btn btn-sec" href="${url}" download="${esc(p.nombreArchivo || p.titulo)}">Guardar en el teléfono</a></div>`;
}

/* ---------- Cargar o editar un papel ---------- */
function formPapel(p) {
  const nuevo = !p;
  p = p || { id: uid(), tipo: 'auto' };
  abrirModal(`<h2>${nuevo ? 'Guardar un papel' : 'Editar papel'}</h2>
    <form id="form-papel" class="form" autocomplete="off">
      <label>Qué es <input name="titulo" required maxlength="80" placeholder="Póliza del seguro del auto" value="${esc(p.titulo || '')}"></label>
      <div class="row">
        <label>Tipo <select name="tipo">${TIPOS_PAPEL.map(t => `<option value="${t.id}"${t.id === p.tipo ? ' selected' : ''}>${t.emoji} ${t.nombre}</option>`).join('')}</select></label>
        <label>Vence <span class="opc">(si vence)</span><input type="date" name="vence" value="${esc(p.vence || '')}"></label>
      </div>
      <label>Nota <span class="opc">(n° de póliza, teléfono de grúa…)</span><textarea name="nota" rows="3" maxlength="600">${esc(p.nota || '')}</textarea></label>
      <label class="btn btn-sec btn-archivo">${p.mime ? 'Cambiar el archivo' : '📷 Foto o PDF'}
        <input type="file" name="archivo" accept="image/*,application/pdf" hidden></label>
      <p class="hint" id="pf-archivo">${p.nombreArchivo ? 'Archivo: ' + esc(p.nombreArchivo) : 'Sin archivo (pueden guardar solo la nota).'}</p>
      <button type="submit" class="btn">Guardar</button>
      <div class="row">
        <button type="button" class="btn btn-sec" id="pf-cancelar">Cancelar</button>
        ${nuevo ? '' : '<button type="button" class="btn btn-peligro" id="pf-borrar">Borrar</button>'}
      </div>
    </form>`);
  const f = $('#form-papel');
  f.archivo.addEventListener('change', () => {
    const a = f.archivo.files[0];
    $('#pf-archivo').textContent = a ? `Archivo: ${a.name} (${Math.round(a.size / 1024)} KB)` : '';
  });
  $('#pf-cancelar').addEventListener('click', cerrarModal);
  $('#pf-borrar')?.addEventListener('click', async () => {
    if (!confirm(`¿Borrar "${p.titulo}"? Se borra también en el otro teléfono.`)) return;
    p.borrado = true; p.mod = Date.now();
    await archivoBorrar(p.id);
    guardar('papeles'); cerrarModal(); pintarPapeles();
  });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = f.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      const a = f.archivo.files[0];
      if (a) {
        if (a.size > MAX_ARCHIVO) throw new Error('el archivo pasa de 15 MB');
        const blob = a.type.startsWith('image/') ? await achicarFoto(a) : a;
        await archivoGuardar(p.id, blob);
        p.mime = blob.type || a.type; p.nombreArchivo = a.name; p.tam = blob.size;
        p.driveId = '';         // archivo nuevo: hay que subirlo otra vez
      }
      Object.assign(p, {
        titulo: f.titulo.value.trim(), tipo: f.tipo.value, vence: f.vence.value,
        nota: f.nota.value.trim(), mod: Date.now()
      });
      if (nuevo) db.papeles.push(p);
      guardar('papeles');
      cerrarModal(); pintarPapeles(); toast('Papel guardado ✓');
    } catch (err) {
      toast('⚠ ' + err.message);
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  });
}

// Achica una foto a 2000 px de lado mayor, en JPEG. Si algo falla, la original.
function achicarFoto(archivo) {
  return new Promise(ok => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 2000 / Math.max(img.width, img.height));
      if (k === 1 && archivo.size < 800 * 1024) { ok(archivo); return; }
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => ok(b || archivo), 'image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => ok(archivo);
    img.src = URL.createObjectURL(archivo);
  });
}
