/* ============================================================
   Los datos de la casa y dónde se guardan.

   Todo vive en localStorage con claves `hogar_*`: la app comparte sitio
   (martintrigo.github.io) con AMA y BioSalud, así que nunca se usa una clave
   sin prefijo ni se borra "todo el sitio".

   Cada registro lleva `mod` (cuándo se tocó, en ms): con eso la
   sincronización sabe qué mandar y, si los dos teléfonos tocaron lo mismo,
   gana el último. Borrar no saca el registro: lo marca `borrado` (una
   "tumba"), para que el otro teléfono también se entere.
   ============================================================ */

const CLAVES = {
  movs: 'hogar_movs',
  papeles: 'hogar_papeles',
  config: 'hogar_config',
  local: 'hogar_local'        // lo que es de ESTE teléfono: quién soy, sincro
};

/* Los colores de los gráficos son ocho, en un orden fijo que se distingue
   también con daltonismo (paleta validada; ver CLAUDE.md). Cada categoría
   tiene su color para siempre: el auto es aqua en todos los gráficos y
   todos los meses. Las categorías sin color van juntas en "Otros". */
const CATS_GASTO = [
  { id: 'alquiler',  nombre: 'Alquiler',  emoji: '🏠', color: 1, detalles: ['alquiler', 'expensas', 'contrato'] },
  { id: 'comida',    nombre: 'Comida',    emoji: '🛒', color: 2, detalles: ['súper', 'verdulería', 'carnicería', 'almacén', 'panadería', 'feria', 'delivery'] },
  { id: 'auto',      nombre: 'Auto',      emoji: '🚗', color: 3, detalles: ['nafta', 'seguro', 'patente', 'service', 'VTV', 'gomería', 'repuestos', 'mecánico', 'lavado', 'peaje'] },
  { id: 'servicios', nombre: 'Servicios', emoji: '💡', color: 4, detalles: ['luz', 'gas', 'garrafa', 'leña', 'agua', 'internet', 'celular', 'streaming'] },
  { id: 'salud',     nombre: 'Salud',     emoji: '💊', color: 5, detalles: ['farmacia', 'consulta', 'obra social', 'dentista', 'análisis'] },
  { id: 'salidas',   nombre: 'Salidas',   emoji: '🍕', color: 6, detalles: ['restorán', 'bar', 'cine', 'viaje', 'recital'] },
  { id: 'casa',      nombre: 'Casa',      emoji: '🔨', color: 7, detalles: ['ferretería', 'limpieza', 'muebles', 'arreglos', 'electrodomésticos'] },
  { id: 'ropa',      nombre: 'Ropa',      emoji: '👕', color: 8, detalles: ['ropa', 'calzado'] },
  { id: 'transporte', nombre: 'Transporte', emoji: '🚌', color: 0, detalles: ['colectivo', 'remis', 'pasajes'] },
  { id: 'educacion', nombre: 'Educación', emoji: '📚', color: 0, detalles: ['cuota', 'libros', 'cursos'] },
  { id: 'mascotas',  nombre: 'Mascotas',  emoji: '🐾', color: 0, detalles: ['alimento', 'veterinaria'] },
  { id: 'regalos',   nombre: 'Regalos',   emoji: '🎁', color: 0, detalles: [] },
  { id: 'impuestos', nombre: 'Impuestos', emoji: '🧾', color: 0, detalles: ['monotributo', 'ingresos brutos', 'municipal'] },
  { id: 'varios',    nombre: 'Varios',    emoji: '✳️', color: 0, detalles: [] }
];
const CATS_INGRESO = [
  { id: 'sueldo',   nombre: 'Sueldo',    emoji: '💼', color: 1, detalles: ['sueldo', 'beca', 'aguinaldo'] },
  { id: 'trabajos', nombre: 'Trabajos',  emoji: '🔧', color: 2, detalles: ['changa', 'factura', 'honorarios'] },
  { id: 'ventas',   nombre: 'Ventas',    emoji: '🧺', color: 3, detalles: [] },
  { id: 'ayudas',   nombre: 'Ayudas',    emoji: '🤝', color: 4, detalles: ['familia', 'asignación'] },
  { id: 'otros_in', nombre: 'Otros ingresos', emoji: '✳️', color: 0, detalles: ['devolución', 'reintegro'] }
];

const MEDIOS = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'debito', nombre: 'Débito' },
  { id: 'credito', nombre: 'Crédito' },
  { id: 'transfer', nombre: 'Transferencia' },
  { id: 'mp', nombre: 'Mercado Pago' }
];

const TIPOS_PAPEL = [
  { id: 'auto', nombre: 'Auto', emoji: '🚗' },
  { id: 'casa', nombre: 'Casa', emoji: '🏠' },
  { id: 'salud', nombre: 'Salud', emoji: '🩺' },
  { id: 'identidad', nombre: 'Identidad', emoji: '🪪' },
  { id: 'impuestos', nombre: 'Impuestos', emoji: '🧾' },
  { id: 'garantias', nombre: 'Garantías', emoji: '🧰' },
  { id: 'otros', nombre: 'Otros', emoji: '📄' }
];

const CONFIG_INICIAL = {
  nombres: { a: 'Martín', b: 'Luna' },
  metaAhorro: 0,                   // % de lo que entra que quieren guardar (0 = sin meta)
  catsGasto: CATS_GASTO,
  catsIngreso: CATS_INGRESO,
  presupuesto: {},                 // { idCategoria: monto por mes }
  mod: 0
};

function leer(clave, porDefecto) {
  try {
    const v = localStorage.getItem(clave);
    return v ? JSON.parse(v) : porDefecto;
  } catch (e) { return porDefecto; }
}
function escribir(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); }
  catch (e) { toast('⚠ No se pudo guardar en el teléfono (¿memoria llena?)'); }
}

const db = {
  movs: leer(CLAVES.movs, []),
  papeles: leer(CLAVES.papeles, []),
  config: Object.assign({}, CONFIG_INICIAL, leer(CLAVES.config, {})),
  local: Object.assign({ yo: '', url: '', clave: '', subidoHasta: 0, ultimaSync: 0 }, leer(CLAVES.local, {}))
};

function guardar(que) {
  if (!que || que === 'movs') escribir(CLAVES.movs, db.movs);
  if (!que || que === 'papeles') escribir(CLAVES.papeles, db.papeles);
  if (!que || que === 'config') escribir(CLAVES.config, db.config);
  if (!que || que === 'local') escribir(CLAVES.local, db.local);
  if (que !== 'local' && typeof avisarCambio === 'function') avisarCambio();
}

/* ---------- Consultas ---------- */

const vivos = lista => lista.filter(r => !r.borrado);
const movsVivos = () => vivos(db.movs);

function movsDelMes(ym, tipo) {
  return movsVivos().filter(m => mesDe(m.fecha) === ym && (!tipo || m.tipo === tipo));
}
const suma = lista => lista.reduce((s, m) => s + (Number(m.monto) || 0), 0);

function cats(tipo) { return tipo === 'ingreso' ? db.config.catsIngreso : db.config.catsGasto; }
function cat(id) {
  return db.config.catsGasto.find(c => c.id === id) || db.config.catsIngreso.find(c => c.id === id)
    || { id, nombre: id || 'Sin categoría', emoji: '•', color: 0, detalles: [] };
}
function nombreQuien(q) {
  if (q === 'a') return db.config.nombres.a;
  if (q === 'b') return db.config.nombres.b;
  return 'Común';
}
function nombreMedio(id) { return (MEDIOS.find(m => m.id === id) || { nombre: id || '' }).nombre; }

// Suma por una clave: { clave: total }, ordenado de mayor a menor como lista.
function agrupar(lista, clave) {
  const t = {};
  lista.forEach(m => { const k = typeof clave === 'function' ? clave(m) : m[clave]; t[k] = (t[k] || 0) + Number(m.monto || 0); });
  return Object.entries(t).sort((x, y) => y[1] - x[1]);
}

// Los meses que tienen algo cargado, del más nuevo al más viejo (y siempre el actual).
function mesesConDatos() {
  const s = new Set(movsVivos().map(m => mesDe(m.fecha)));
  s.add(mesDe(hoy()));
  return [...s].filter(Boolean).sort().reverse();
}

/* ---------- Escritura ---------- */

function guardarMov(m) {
  m.mod = Date.now();
  const i = db.movs.findIndex(x => x.id === m.id);
  if (i > -1) db.movs[i] = m; else db.movs.push(m);
  guardar('movs');
}
function borrarMov(id) {
  const m = db.movs.find(x => x.id === id);
  if (!m) return;
  m.borrado = true; m.mod = Date.now();
  guardar('movs');
}
function guardarConfig() {
  db.config.mod = Date.now();
  guardar('config');
}
