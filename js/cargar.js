/* ============================================================
   Pestaña Cargar: anotar un gasto o un ingreso en pocos toques.
   El mismo formulario sirve para corregir uno viejo (`editando`).
   ============================================================ */

const formMov = {
  tipo: 'gasto',
  cat: '',
  quien: '',
  medio: '',
  editando: null      // el movimiento que se está corrigiendo, o null
};

function initCargar() {
  const f = $('#form-mov');
  f.fecha.value = hoy();

  $$('.tipo-toggle button').forEach(b => b.addEventListener('click', () => ponerTipo(b.dataset.tipo)));

  f.monto.addEventListener('input', () => f.monto.classList.remove('error'));
  f.monto.addEventListener('blur', () => {
    const n = num(f.monto.value);
    if (n) f.monto.value = n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  });

  f.addEventListener('submit', e => { e.preventDefault(); guardarForm(); });
  pintarCargar();
}

function ponerTipo(tipo) {
  formMov.tipo = tipo;
  $$('.tipo-toggle button').forEach(b => b.classList.toggle('activo', b.dataset.tipo === tipo));
  $('#form-mov').classList.toggle('es-ingreso', tipo === 'ingreso');
  if (!cats(tipo).some(c => c.id === formMov.cat)) formMov.cat = '';
  // El medio de pago solo tiene sentido en los gastos
  $('#campo-medio').classList.toggle('hidden', tipo === 'ingreso');
  pintarCats();
}

function pintarCargar() {
  if (!formMov.quien) formMov.quien = db.local.yo || 'a';
  pintarCats();
  pintarChips();
  pintarUltimos();
}

function pintarCats() {
  const grid = $('#cat-grid');
  grid.innerHTML = cats(formMov.tipo).map(c => `
    <button type="button" class="cat-btn${c.id === formMov.cat ? ' activo' : ''}" data-cat="${c.id}">
      <span class="cat-emoji">${esc(c.emoji)}</span><span>${esc(c.nombre)}</span>
    </button>`).join('');
  grid.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => {
    formMov.cat = b.dataset.cat;
    grid.querySelectorAll('.cat-btn').forEach(x => x.classList.toggle('activo', x === b));
    grid.classList.remove('error');
    pintarSugerencias();
  }));
  pintarSugerencias();
}

// Lo que se sugiere en "Detalle": lo de la categoría más lo ya usado en ella.
function pintarSugerencias() {
  const c = cat(formMov.cat);
  const usados = movsVivos().filter(m => m.cat === formMov.cat && m.detalle).map(m => m.detalle);
  const todos = [...new Set([...usados.reverse(), ...(c.detalles || [])])].slice(0, 30);
  $('#sugerencias').innerHTML = todos.map(d => `<option value="${esc(d)}">`).join('');
}

function pintarChips() {
  const quien = [['a', db.config.nombres.a], ['b', db.config.nombres.b], ['comun', 'Común']];
  $('#chips-quien').innerHTML = quien.map(([id, n]) =>
    `<button type="button" class="chip${formMov.quien === id ? ' activo' : ''}" data-v="${id}">${esc(n)}</button>`).join('');
  $('#chips-medio').innerHTML = MEDIOS.map(m =>
    `<button type="button" class="chip${formMov.medio === m.id ? ' activo' : ''}" data-v="${m.id}">${m.nombre}</button>`).join('');
  $$('#chips-quien .chip').forEach(b => b.addEventListener('click', () => { formMov.quien = b.dataset.v; pintarChips(); }));
  $$('#chips-medio .chip').forEach(b => b.addEventListener('click', () => {
    formMov.medio = formMov.medio === b.dataset.v ? '' : b.dataset.v;  // tocar de nuevo lo saca
    pintarChips();
  }));
}

function guardarForm() {
  const f = $('#form-mov');
  const monto = num(f.monto.value);
  if (!(monto > 0)) { f.monto.classList.add('error'); f.monto.focus(); toast('Falta el monto'); return; }
  if (!formMov.cat) { $('#cat-grid').classList.add('error'); toast('Elegí una categoría'); return; }

  const m = Object.assign({}, formMov.editando || { id: uid() }, {
    tipo: formMov.tipo,
    fecha: f.fecha.value || hoy(),
    monto,
    cat: formMov.cat,
    detalle: f.detalle.value.trim(),
    quien: formMov.quien,
    medio: formMov.tipo === 'gasto' ? formMov.medio : '',
    nota: f.nota.value.trim(),
    fijo: f.fijo.checked
  });
  const eraEdicion = !!formMov.editando;
  guardarMov(m);
  toast(eraEdicion ? 'Corregido ✓' : `${cat(m.cat).emoji} ${fmt(m.monto)} guardado ✓`);

  // Queda listo para el próximo: misma fecha, mismo quién y medio
  formMov.editando = null;
  formMov.cat = '';
  f.monto.value = ''; f.detalle.value = ''; f.nota.value = '';
  f.fijo.checked = false;
  f.querySelector('.btn[type=submit]').textContent = 'Guardar';
  $('#cancelar-edicion')?.remove();
  $('#borrar-mov')?.remove();
  pintarCats();
  pintarUltimos();
  if (eraEdicion) irA('movs');
}

function editarMov(id) {
  const m = db.movs.find(x => x.id === id);
  if (!m) return;
  irA('cargar');
  const f = $('#form-mov');
  formMov.editando = m;
  ponerTipo(m.tipo);
  formMov.cat = m.cat; formMov.quien = m.quien || 'comun'; formMov.medio = m.medio || '';
  f.monto.value = Number(m.monto).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  f.fecha.value = m.fecha; f.detalle.value = m.detalle || ''; f.nota.value = m.nota || '';
  f.fijo.checked = !!m.fijo;
  f.querySelector('.btn[type=submit]').textContent = 'Guardar corrección';
  if (!$('#cancelar-edicion')) {
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'cancelar-edicion'; b.className = 'btn btn-sec';
    b.textContent = 'Cancelar';
    b.addEventListener('click', () => {
      formMov.editando = null; f.reset(); f.fecha.value = hoy(); formMov.cat = '';
      f.querySelector('.btn[type=submit]').textContent = 'Guardar';
      b.remove(); $('#borrar-mov')?.remove(); pintarCats(); irA('movs');
    });
    f.appendChild(b);
    const borrar = document.createElement('button');
    borrar.type = 'button'; borrar.id = 'borrar-mov'; borrar.className = 'btn btn-peligro';
    borrar.textContent = 'Borrar este movimiento';
    borrar.addEventListener('click', () => {
      if (!confirm('¿Borrar este movimiento? Se borra también en el otro teléfono.')) return;
      borrarMov(formMov.editando.id);
      toast('Borrado');
      b.click();
    });
    f.appendChild(borrar);
  }
  pintarCats(); pintarChips();
  window.scrollTo(0, 0);
}

// Un renglón de movimiento, igual en "Últimos", la lista y el top del mes.
function filaMov(m, conFecha = true) {
  const c = cat(m.cat);
  const sub = [conFecha ? fmtFecha(m.fecha) : '', nombreQuien(m.quien), nombreMedio(m.medio),
    m.fijo ? '↻ fijo' : ''].filter(Boolean).join(' · ');
  return `<button class="mov" data-id="${m.id}">
    <span class="mov-ico" style="--c:var(--s${c.color || 0})">${esc(c.emoji)}</span>
    <span class="mov-txt"><b>${esc(c.nombre)}${m.detalle ? ' · ' + esc(m.detalle) : ''}</b>
      <small>${esc(sub)}${m.nota ? ' — ' + esc(m.nota) : ''}</small></span>
    <span class="mov-monto ${m.tipo}">${m.tipo === 'ingreso' ? '+' : '−'}${fmt(m.monto)}</span>
  </button>`;
}

function pintarUltimos() {
  const ult = movsVivos().sort((a, b) => b.mod - a.mod).slice(0, 5);
  const cont = $('#ultimos');
  cont.innerHTML = ult.length ? ult.map(m => filaMov(m)).join('') : vacio('Lo que carguen aparece acá.');
  cont.querySelectorAll('.mov').forEach(b => b.addEventListener('click', () => editarMov(b.dataset.id)));
}
