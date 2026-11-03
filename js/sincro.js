/* ============================================================
   Sincronización con la planilla de Google (Apps Script).

   Cómo funciona, en criollo:
   1. La app manda lo que se tocó desde la última vez (`subidoHasta`).
   2. El script lo mete en la planilla: si el renglón ya estaba, gana el
      que tenga el `mod` más nuevo.
   3. El script devuelve TODO (para un hogar son pocos renglones: ~100 por
      mes) y la app se queda con lo más nuevo de cada uno.
   4. Después sube a Drive los archivos de papeles que todavía no subió.

   La dirección del script y la clave se guardan solo en este teléfono
   (`hogar_local`): el repositorio es público y no pueden ir en el código.
   El pedido va como text/plain para que el navegador no haga la consulta
   previa (CORS), que Apps Script no contesta.
   ============================================================ */

let sincronizando = false;
let timerSync = null;

function hayCambiosSinSubir() {
  const desde = db.local.subidoHasta || 0;
  return db.movs.some(m => m.mod > desde) || db.papeles.some(p => p.mod > desde) || db.config.mod > desde;
}

// Cada cambio programa una sincronización a los 4 s (si se cargan varios
// seguidos, viajan juntos).
function avisarCambio() {
  marcarEstadoSync();
  if (!db.local.url) return;
  clearTimeout(timerSync);
  timerSync = setTimeout(() => sincronizar(true), 4000);
}

async function llamarScript(cuerpo) {
  const r = await fetch(db.local.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ clave: db.local.clave }, cuerpo))
  });
  if (!r.ok) throw new Error('el script respondió ' + r.status);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'respuesta rara del script');
  if (j.app !== 'hogar') throw new Error('esa dirección no es el script de HOGAR');
  return j;
}

// Junta lo que viene del servidor con lo local: gana el `mod` más nuevo.
function fusionar(locales, remotos) {
  const porId = new Map(locales.map(r => [r.id, r]));
  remotos.forEach(r => {
    const l = porId.get(r.id);
    if (!l || Number(r.mod) > Number(l.mod)) {
      // driveId y archivo: si el local ya los sabe y el remoto no, se conservan
      porId.set(r.id, Object.assign({}, l || {}, r));
    }
  });
  return [...porId.values()];
}

async function sincronizar(silencioso) {
  if (!db.local.url || sincronizando || !navigator.onLine) { marcarEstadoSync(); return; }
  sincronizando = true;
  $('#btnSync').classList.add('girando');
  const desde = db.local.subidoHasta || 0;
  const enviadoEn = Date.now();
  try {
    const j = await llamarScript({
      accion: 'sync',
      movs: db.movs.filter(m => m.mod > desde),
      papeles: db.papeles.filter(p => p.mod > desde),
      config: db.config.mod > desde ? db.config : null
    });
    db.movs = fusionar(db.movs, (j.movs || []).map(normalizarMov));
    db.papeles = fusionar(db.papeles, (j.papeles || []).map(normalizarPapel));
    if (j.config && Number(j.config.mod) > Number(db.config.mod || 0)) db.config = Object.assign({}, CONFIG_INICIAL, j.config);
    db.local.subidoHasta = enviadoEn;
    db.local.ultimaSync = Date.now();
    db.local.error = '';
    escribir(CLAVES.movs, db.movs); escribir(CLAVES.papeles, db.papeles); escribir(CLAVES.config, db.config);
    guardar('local');
    await subirArchivosPendientes();
    bajarArchivosFaltantes();   // por detrás: no hace esperar a la sincronización
    if (!silencioso) toast('Sincronizado ✓');
    repintar();
  } catch (e) {
    db.local.error = e.message; guardar('local');
    if (!silencioso) toast('⚠ No se pudo sincronizar: ' + e.message);
  } finally {
    sincronizando = false;
    $('#btnSync').classList.remove('girando');
    marcarEstadoSync();
  }
}

/* La planilla devuelve todo como texto: "TRUE", "12500.5", "1730600000000".
   Acá se vuelve a número y a verdadero/falso ("FALSE" como texto sería
   verdadero para JavaScript y borraría el registro). */
const siNo = v => v === true || String(v).toLowerCase() === 'true';
function normalizarMov(m) {
  return Object.assign({}, m, {
    fecha: String(m.fecha).slice(0, 10), monto: Number(m.monto) || num(m.monto), mod: Number(m.mod),
    fijo: siNo(m.fijo), personal: siNo(m.personal), borrado: siNo(m.borrado)
  });
}
function normalizarPapel(p) {
  return Object.assign({}, p, {
    vence: p.vence ? String(p.vence).slice(0, 10) : '', mod: Number(p.mod), tam: Number(p.tam) || 0,
    borrado: siNo(p.borrado)
  });
}

async function subirArchivosPendientes() {
  const locales = await idsConArchivo();
  for (const p of vivos(db.papeles).filter(p => p.mime && !p.driveId && locales.has(p.id))) {
    const blob = await archivoLeer(p.id);
    const b64 = await new Promise(ok => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.readAsDataURL(blob);
    });
    const j = await llamarScript({ accion: 'subir', id: p.id, nombre: p.nombreArchivo || p.titulo, mime: p.mime, datos: b64 });
    p.driveId = j.driveId; p.mod = Date.now();
    escribir(CLAVES.papeles, db.papeles);
    // El registro con su driveId sale en la próxima sincronización
    clearTimeout(timerSync);
    timerSync = setTimeout(() => sincronizar(true), 1500);
  }
}

/* Cada teléfono tiene TODOS los papeles, no solo los que cargó: apenas
   sincroniza, baja de Drive los que le faltan. Así el seguro del auto se
   abre en la ruta sin señal aunque lo haya sacado la foto el otro. */
let bajandoArchivos = false;
async function bajarArchivosFaltantes() {
  if (bajandoArchivos) return;
  bajandoArchivos = true;
  try {
    const locales = await idsConArchivo();
    for (const p of vivos(db.papeles).filter(p => p.mime && p.driveId && !locales.has(p.id))) {
      try { await archivoGuardar(p.id, await bajarArchivo(p)); } catch (e) { break; }  // sin señal: sigue la próxima vez
    }
  } finally {
    bajandoArchivos = false;
    if (pestana === 'papeles') pintarPapeles();
  }
}

async function bajarArchivo(p) {
  const j = await llamarScript({ accion: 'bajar', driveId: p.driveId });
  const bin = atob(j.datos);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: j.mime || p.mime });
}

function marcarEstadoSync() {
  const b = $('#btnSync');
  b.classList.toggle('pendiente', !!db.local.url && hayCambiosSinSubir());
  b.classList.toggle('sync-error', !!db.local.error);
  b.classList.toggle('hidden', !db.local.url);
  const est = $('#aj-sync-estado');
  if (est) est.textContent = !db.local.url ? 'Sin conectar: los datos quedan solo en este teléfono.'
    : db.local.error ? '⚠ Último intento: ' + db.local.error
    : db.local.ultimaSync ? 'Conectado. Última sincronización: ' + new Date(db.local.ultimaSync).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Conectado, todavía sin sincronizar.';
}
