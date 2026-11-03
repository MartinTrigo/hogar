/* ============================================================
   Pestaña Ajustes: tema, nombres, categorías y presupuesto,
   sincronización y respaldo.
   ============================================================ */

const TEMAS = [
  { id: '', nombre: 'Como el teléfono', muestra: 'linear-gradient(135deg,#FAF6EF 50%,#1A1511 50%)' },
  { id: 'claro', nombre: 'Claro', muestra: '#FAF6EF' },
  { id: 'oscuro', nombre: 'Oscuro', muestra: '#1A1511' },
  { id: 'madera', nombre: 'Madera clara', muestra: 'linear-gradient(100deg,#D2A86E,#B9874F 40%,#D6AE74 70%,#B07D47)' },
  { id: 'nogal', nombre: 'Nogal', muestra: 'linear-gradient(100deg,#5A3820,#3F2715 45%,#5E3B22 75%,#3A2413)' }
];

function ponerTema(id) {
  if (id) document.documentElement.dataset.tema = id; else delete document.documentElement.dataset.tema;
  try { localStorage.setItem('hogar_tema', id); } catch (e) {}
  prepararMadera();
  const oscuro = getComputedStyle(document.documentElement).getPropertyValue('--cab').trim();
  document.querySelector('meta[name=theme-color]').setAttribute('content', oscuro || '#7A4E2A');
  pintarTemas();
}
function temaActual() { return document.documentElement.dataset.tema || ''; }

function pintarTemas() {
  $('#temas').innerHTML = TEMAS.map(t => `<button class="tema${t.id === temaActual() ? ' activo' : ''}" data-tema="${t.id}">
    <span class="tema-muestra" style="background:${t.muestra}"></span>${t.nombre}</button>`).join('');
  $$('#temas .tema').forEach(b => b.addEventListener('click', () => ponerTema(b.dataset.tema)));
}

function initAjustes() {
  // El botón de arriba recorre los temas uno por uno
  $('#btnTema').addEventListener('click', () => {
    const i = TEMAS.findIndex(t => t.id === temaActual());
    const sig = TEMAS[(i + 1) % TEMAS.length];
    ponerTema(sig.id);
    toast('Tema: ' + sig.nombre);
  });

  $('#aj-a').addEventListener('change', e => { db.config.nombres.a = e.target.value.trim() || 'Persona 1'; guardarConfig(); repintar(); });
  $('#aj-b').addEventListener('change', e => { db.config.nombres.b = e.target.value.trim() || 'Persona 2'; guardarConfig(); repintar(); });
  $('#aj-meta').addEventListener('change', e => {
    db.config.metaAhorro = Math.max(0, Math.min(90, Number(e.target.value) || 0)); guardarConfig();
  });
  $('#aj-yo').addEventListener('change', e => { db.local.yo = e.target.value; formMov.quien = e.target.value; guardar('local'); pintarCargar(); });

  $('#aj-cat-nueva').addEventListener('click', () => {
    const nombre = prompt('Nombre de la categoría nueva (gasto):');
    if (!nombre || !nombre.trim()) return;
    const emoji = prompt('Un emoji para reconocerla (opcional):', '•') || '•';
    db.config.catsGasto = [...db.config.catsGasto, {
      id: 'c_' + uid(), nombre: nombre.trim(), emoji: emoji.trim().slice(0, 4), color: 0, detalles: []
    }];
    guardarConfig(); pintarAjustes();
  });

  $('#aj-sync-guardar').addEventListener('click', async () => {
    const url = $('#aj-url').value.trim(), clave = $('#aj-clave').value;
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) { toast('La dirección tiene que terminar en /exec'); return; }
    Object.assign(db.local, { url, clave, subidoHasta: 0, error: '' });  // la primera vez manda todo
    guardar('local');
    await sincronizar();
  });
  $('#aj-sync-quitar').addEventListener('click', () => {
    if (!confirm('¿Desconectar? Los datos quedan en este teléfono, pero dejan de compartirse.')) return;
    Object.assign(db.local, { url: '', clave: '', error: '' });
    guardar('local'); pintarAjustes(); marcarEstadoSync();
  });

  $('#aj-exportar').addEventListener('click', () => {
    descargar(`hogar_respaldo_${hoy()}.json`, JSON.stringify({
      app: 'hogar', fecha: new Date().toISOString(), movs: db.movs, papeles: db.papeles, config: db.config
    }, null, 1), 'application/json');
  });
  $('#aj-importar').addEventListener('change', async e => {
    const a = e.target.files[0];
    if (!a) return;
    try {
      const d = JSON.parse(await a.text());
      if (d.app !== 'hogar') throw new Error('no es un respaldo de HOGAR');
      if (!confirm(`Respaldo del ${fmtFecha(d.fecha.slice(0, 10))}: ${d.movs.length} movimientos. Se junta con lo que hay (gana lo más nuevo). ¿Seguir?`)) return;
      db.movs = fusionar(db.movs, d.movs);
      db.papeles = fusionar(db.papeles, d.papeles || []);
      if ((d.config?.mod || 0) > (db.config.mod || 0)) db.config = Object.assign({}, CONFIG_INICIAL, d.config);
      db.local.subidoHasta = 0;           // que viaje todo a la planilla
      guardar(); repintar(); toast('Respaldo recuperado ✓');
    } catch (err) { toast('⚠ ' + err.message); }
    e.target.value = '';
  });
}

function pintarAjustes() {
  pintarTemas();
  const { a, b } = db.config.nombres;
  $('#aj-a').value = a; $('#aj-b').value = b;
  $('#aj-meta').value = db.config.metaAhorro || '';
  $('#aj-yo').innerHTML = `<option value="">—</option><option value="a">${esc(a)}</option><option value="b">${esc(b)}</option>`;
  $('#aj-yo').value = db.local.yo || '';
  $('#aj-url').value = db.local.url || '';
  $('#aj-clave').value = db.local.clave || '';
  marcarEstadoSync();

  const pres = db.config.presupuesto || {};
  $('#aj-cats').innerHTML = db.config.catsGasto.map(c => `
    <div class="aj-cat" data-id="${c.id}">
      <input class="aj-emoji" value="${esc(c.emoji)}" maxlength="4" aria-label="Emoji">
      <input class="aj-nombre" value="${esc(c.nombre)}" maxlength="24" aria-label="Nombre">
      <input class="aj-pres" type="text" inputmode="numeric" placeholder="sin tope" value="${pres[c.id] ? Number(pres[c.id]).toLocaleString('es-AR') : ''}" aria-label="Presupuesto por mes">
      <span class="muestra" style="background:var(--s${c.color || 0})" title="${c.color ? 'Color propio en los gráficos' : 'Va en Otros'}"></span>
    </div>`).join('');
  $$('#aj-cats .aj-cat').forEach(fila => {
    const c = db.config.catsGasto.find(x => x.id === fila.dataset.id);
    fila.querySelector('.aj-emoji').addEventListener('change', e => { c.emoji = e.target.value.trim() || '•'; guardarConfig(); });
    fila.querySelector('.aj-nombre').addEventListener('change', e => { c.nombre = e.target.value.trim() || c.nombre; guardarConfig(); });
    fila.querySelector('.aj-pres').addEventListener('change', e => {
      const v = num(e.target.value);
      db.config.presupuesto = Object.assign({}, db.config.presupuesto);
      if (v > 0) db.config.presupuesto[c.id] = v; else delete db.config.presupuesto[c.id];
      e.target.value = v > 0 ? v.toLocaleString('es-AR') : '';
      guardarConfig();
    });
  });
}
