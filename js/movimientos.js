/* ============================================================
   Pestaña Lista: todos los movimientos, con buscador y filtros.
   Tocar uno lo abre para corregir o borrar.
   ============================================================ */

function initMovs() {
  ['#f-texto', '#f-mes', '#f-cat', '#f-quien', '#f-tipo'].forEach(s =>
    $(s).addEventListener('input', pintarMovs));
}

function llenarFiltrosMovs() {
  const fm = $('#f-mes'), fc = $('#f-cat'), fq = $('#f-quien');
  const vm = fm.value || mesDe(hoy()), vc = fc.value, vq = fq.value;
  fm.innerHTML = '<option value="todo">Todos los meses</option>' +
    mesesConDatos().map(ym => `<option value="${ym}">${nombreMes(ym)}</option>`).join('');
  fm.value = [...fm.options].some(o => o.value === vm) ? vm : mesDe(hoy());
  fc.innerHTML = '<option value="">Todas las categorías</option>' +
    [...db.config.catsGasto, ...db.config.catsIngreso].map(c => `<option value="${c.id}">${esc(c.emoji)} ${esc(c.nombre)}</option>`).join('');
  fc.value = vc;
  fq.innerHTML = `<option value="">Los dos y común</option><option value="a">${esc(db.config.nombres.a)}</option>
    <option value="b">${esc(db.config.nombres.b)}</option><option value="comun">Común</option>`;
  fq.value = vq;
}

function movsFiltrados() {
  const texto = $('#f-texto').value.trim().toLowerCase();
  const mes = $('#f-mes').value, c = $('#f-cat').value, q = $('#f-quien').value, t = $('#f-tipo').value;
  return movsVivos().filter(m =>
    (mes === 'todo' || mesDe(m.fecha) === mes) && (!c || m.cat === c) && (!q || m.quien === q) && (!t || m.tipo === t) &&
    (!texto || [cat(m.cat).nombre, m.detalle, m.nota, nombreQuien(m.quien), nombreMedio(m.medio), String(m.monto)]
      .join(' ').toLowerCase().includes(texto))
  ).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.mod - a.mod);
}

function pintarMovs() {
  const lista = movsFiltrados();
  const tG = suma(lista.filter(m => m.tipo === 'gasto')), tI = suma(lista.filter(m => m.tipo === 'ingreso'));
  $('#movs-total').innerHTML = lista.length
    ? `${lista.length} movimientos · <span class="gasto">gastos ${fmt(tG)}</span>${tI ? ` · <span class="pos">ingresos ${fmt(tI)}</span>` : ''}`
    : '';

  if (!lista.length) { $('#movs-lista').innerHTML = `<div class="card">${vacio('No hay nada con ese filtro.')}</div>`; return; }

  // Agrupados por día, con el total del día
  const dias = {};
  lista.forEach(m => (dias[m.fecha] = dias[m.fecha] || []).push(m));
  $('#movs-lista').innerHTML = Object.entries(dias).map(([f, ms]) => {
    const [y, mo, d] = f.split('-').map(Number);
    const dia = DIAS[new Date(y, mo - 1, d).getDay()];
    const g = suma(ms.filter(m => m.tipo === 'gasto'));
    return `<div class="card dia">
      <div class="dia-cab"><span>${dia} ${d} de ${MESES[mo - 1]}</span>${g ? `<span class="gasto">−${fmt(g)}</span>` : ''}</div>
      <div class="lista">${ms.map(m => filaMov(m, false)).join('')}</div></div>`;
  }).join('');
  $$('#movs-lista .mov').forEach(b => b.addEventListener('click', () => editarMov(b.dataset.id)));
}
