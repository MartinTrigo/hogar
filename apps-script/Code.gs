/* ============================================================
   HOGAR · servidor en Apps Script (pegado en la planilla del hogar).

   Recibe de cada teléfono lo que cambió, lo escribe en la planilla y
   devuelve todo. Guarda los archivos de Papeles en una carpeta de Drive.

   Seguridad: el Web App queda abierto a "cualquiera" (si no, los teléfonos
   no pueden llamarlo sin iniciar sesión), así que cada pedido trae una
   clave que se compara con la propiedad HOGAR_CLAVE del script. La clave
   no está en ningún archivo del repositorio.
   ============================================================ */

var COLUMNAS = {
  movimientos: ['id', 'fecha', 'tipo', 'monto', 'cat', 'detalle', 'quien', 'medio', 'fijo', 'personal', 'nota', 'mod', 'borrado'],
  papeles: ['id', 'titulo', 'tipo', 'vence', 'nota', 'nombreArchivo', 'mime', 'tam', 'driveId', 'mod', 'borrado']
};
var MAX_BYTES = 15 * 1024 * 1024;

function doGet() {
  return json({ ok: true, app: 'hogar', mensaje: 'HOGAR funcionando. Los teléfonos usan POST.' });
}

function doPost(e) {
  var p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, app: 'hogar', error: 'pedido ilegible' }); }

  var clave = PropertiesService.getScriptProperties().getProperty('HOGAR_CLAVE');
  if (!clave) return json({ ok: false, app: 'hogar', error: 'falta poner HOGAR_CLAVE en las propiedades del script' });
  if (p.clave !== clave) return json({ ok: false, app: 'hogar', error: 'clave incorrecta' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);   // si los dos teléfonos sincronizan a la vez, uno espera
  try {
    if (p.accion === 'sync') return json(sync(p));
    if (p.accion === 'subir') return json(subir(p));
    if (p.accion === 'bajar') return json(bajar(p));
    return json({ ok: false, app: 'hogar', error: 'acción desconocida' });
  } catch (err) {
    return json({ ok: false, app: 'hogar', error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function sync(p) {
  var movs = fusionarHoja('movimientos', p.movs || []);
  var papeles = fusionarHoja('papeles', p.papeles || []);

  // Ajustes compartidos (nombres, categorías, presupuesto): un JSON en una celda
  var hoja = hojaLlamada('ajustes', ['json', 'mod']);
  var actual = hoja.getRange(2, 1, 1, 2).getValues()[0];
  var config = actual[0] ? JSON.parse(actual[0]) : null;
  if (p.config && (!config || Number(p.config.mod) > Number(config.mod || 0))) {
    config = p.config;
    hoja.getRange(2, 1, 1, 2).setValues([[JSON.stringify(config), config.mod]]);
  }
  return { ok: true, app: 'hogar', movs: movs, papeles: papeles, config: config };
}

/* Escribe lo que llegó (gana el `mod` más nuevo) y devuelve todo. Las
   columnas de fecha van como texto ('@') para que Sheets no las convierta
   a fecha con huso horario y las corra un día. */
function fusionarHoja(nombre, entrantes) {
  var cols = COLUMNAS[nombre];
  var hoja = hojaLlamada(nombre, cols);
  var n = hoja.getLastRow() - 1;
  var filas = n > 0 ? hoja.getRange(2, 1, n, cols.length).getValues() : [];
  var indice = {};
  filas.forEach(function (f, i) { indice[f[0]] = i; });
  var iMod = cols.indexOf('mod');

  var nuevas = [];
  entrantes.forEach(function (r) {
    if (!r || !r.id) return;
    var fila = cols.map(function (c) { var v = r[c]; return v === undefined || v === null ? '' : v; });
    if (indice.hasOwnProperty(r.id)) {
      var i = indice[r.id];
      if (Number(r.mod) > Number(filas[i][iMod])) {
        filas[i] = fila;
        hoja.getRange(i + 2, 1, 1, cols.length).setValues([fila]);
      }
    } else {
      indice[r.id] = filas.length;
      filas.push(fila);
      nuevas.push(fila);
    }
  });
  if (nuevas.length) hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, cols.length).setValues(nuevas);

  return filas.map(function (f) {
    var o = {};
    cols.forEach(function (c, j) { o[c] = f[j] instanceof Date ? isoDe(f[j]) : f[j]; });
    return o;
  });
}

function hojaLlamada(nombre, cols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    h.setFrozenRows(1);
    h.getRange('A:Z').setNumberFormat('@');   // todo como texto: nada de fechas corridas
    var iMonto = cols.indexOf('monto');
    if (iMonto > -1) h.getRange(2, iMonto + 1, h.getMaxRows() - 1, 1).setNumberFormat('#,##0.##');
  }
  return h;
}

/* ---------- Archivos de Papeles ---------- */
function carpeta() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('HOGAR_CARPETA');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var c = DriveApp.createFolder('HOGAR · Papeles');
  props.setProperty('HOGAR_CARPETA', c.getId());
  return c;
}

function subir(p) {
  var bytes = Utilities.base64Decode(p.datos);
  if (bytes.length > MAX_BYTES) throw new Error('el archivo pasa de 15 MB');
  var nombre = String(p.nombre || 'papel').replace(/[\\\/]/g, '-');
  var archivo = carpeta().createFile(Utilities.newBlob(bytes, p.mime || 'application/octet-stream', nombre));
  archivo.setDescription('HOGAR ' + p.id);
  return { ok: true, app: 'hogar', driveId: archivo.getId() };
}

// Solo entrega archivos de la carpeta del hogar: con la clave no se puede
// pedir cualquier otro archivo del Drive.
function bajar(p) {
  var archivo = DriveApp.getFileById(p.driveId);
  var padres = archivo.getParents(), idCarpeta = carpeta().getId(), adentro = false;
  while (padres.hasNext()) if (padres.next().getId() === idCarpeta) adentro = true;
  if (!adentro) throw new Error('ese archivo no es de HOGAR');
  var blob = archivo.getBlob();
  return { ok: true, app: 'hogar', mime: blob.getContentType(), datos: Utilities.base64Encode(blob.getBytes()) };
}

function isoDe(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* Correr UNA vez a mano desde el editor: crea las hojas y la carpeta, y
   pide los permisos de Drive y Sheets. */
function configurar() {
  hojaLlamada('movimientos', COLUMNAS.movimientos);
  hojaLlamada('papeles', COLUMNAS.papeles);
  hojaLlamada('ajustes', ['json', 'mod']);
  var c = carpeta();
  /* La clave se inventa sola (cuatro palabras al azar, fácil de tipear en
     el teléfono) y queda en las propiedades del script. Se muestra acá
     para copiarla a los dos teléfonos; se puede volver a ver corriendo
     `verClave`. */
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('HOGAR_CLAVE')) props.setProperty('HOGAR_CLAVE', claveNueva());
  Logger.log('Listo. Carpeta de papeles: ' + c.getUrl());
  verClave();
}

function verClave() {
  Logger.log('Clave para los teléfonos:  ' + PropertiesService.getScriptProperties().getProperty('HOGAR_CLAVE'));
}

function claveNueva() {
  var palabras = ['nogal', 'lenga', 'coihue', 'maiten', 'radal', 'ciprés', 'roble', 'notro', 'calafate', 'maqui',
    'frutilla', 'zapallo', 'acelga', 'puerro', 'girasol', 'trigo', 'lupino', 'avena', 'haba', 'nabo',
    'leña', 'fogón', 'mate', 'tetera', 'ventana', 'huerta', 'arroyo', 'cerro', 'nube', 'lluvia', 'helada', 'brote'];
  var p = [];
  for (var i = 0; i < 4; i++) p.push(palabras[Math.floor(Math.random() * palabras.length)]);
  return p.join('-') + '-' + Math.floor(10 + Math.random() * 90);
}
