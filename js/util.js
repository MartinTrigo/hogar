/* ============================================================
   Utilidades compartidas. Se carga primero: no depende de nada.
   (Las mismas de AMA Economía, más lo que pide el hogar.)
   ============================================================ */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const fmt = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-AR');
// Para los ejes y lo que tiene poco lugar: $1,2 M, $350 mil.
function fmtCorto(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return '$' + (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M';
  if (a >= 1e3) return '$' + Math.round(n / 1e3).toLocaleString('es-AR') + ' mil';
  return fmt(n);
}
const pct = (parte, total) => total ? Math.round(parte / total * 100) : 0;

// Convierte a número tolerando texto, vacío y formato con separadores
// ("12.500", "12.500,50", "12500.5").
function num(v) {
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v).replace(/[^\d,.\-]/g, '');
  if (!s) return 0;
  let limpio;
  if (s.indexOf(',') > -1) limpio = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) limpio = s.replace(/\./g, ''); // 12.500 = doce mil quinientos
  else limpio = s;
  return Number(limpio) || 0;
}

function hoy() { return isoDe(new Date()); }
function isoDe(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
const mesDe = iso => String(iso || '').slice(0, 7);   // 'YYYY-MM'

function fmtFecha(iso) {
  const [y, m, d] = String(iso || '').split('-');
  return d ? `${d}/${m}/${y.slice(2)}` : String(iso || '');
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function nombreMes(ym, corto) { // 'YYYY-MM' -> 'noviembre 2026' / 'nov'
  const [y, m] = ym.split('-');
  const n = MESES[Number(m) - 1];
  return corto ? n.slice(0, 3) : n + ' ' + y;
}
function sumarMeses(ym, k) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function diasDelMes(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
// Días hasta una fecha ISO (negativo si ya pasó).
function diasHasta(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const hoyD = new Date(); hoyD.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - hoyD) / 86400000);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2400);
}

function descargar(nombre, contenido, mime) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function abrirModal(html) {
  $('#modal-box').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function cerrarModal() {
  $('#modal').classList.add('hidden');
  $('#modal-box').innerHTML = '';
}
