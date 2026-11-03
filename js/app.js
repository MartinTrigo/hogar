/* ============================================================
   Arranque y navegación entre pestañas.
   ============================================================ */

const VERSION_APP = '1.1 · 03/11/2026';
let pestana = 'cargar';

function irA(tab) {
  pestana = tab;
  $$('.tab').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + tab));
  $$('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#tooltip').classList.add('hidden');
  repintar();
  window.scrollTo(0, 0);
}

// Repinta solo la pestaña que se ve: las otras se pintan al entrar.
function repintar() {
  const { a, b } = db.config.nombres;
  $('#subtitulo').textContent = `la casa de ${a} y ${b}`;
  if (pestana === 'cargar') pintarCargar();
  if (pestana === 'mes') pintarMes();
  if (pestana === 'movs') { llenarFiltrosMovs(); pintarMovs(); }
  if (pestana === 'informes') pintarInformes();
  if (pestana === 'papeles') pintarPapeles();
  if (pestana === 'ajustes') pintarAjustes();
}

document.addEventListener('DOMContentLoaded', () => {
  initCargar(); initMes(); initMovs(); initInformes(); initPapeles(); initAjustes();
  $('#version').textContent = VERSION_APP;

  $$('#tabbar button').forEach(b => b.addEventListener('click', () => irA(b.dataset.tab)));
  // Enlaces internos ("ver en Informes", avisos de papeles)
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-ir]');
    if (el) { e.preventDefault(); irA(el.dataset.ir); }
  });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') cerrarModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });
  $('#btnSync').addEventListener('click', () => sincronizar());

  // La primera vez: ¿quién usa este teléfono? (para que "Quién" venga puesto)
  if (!db.local.yo) {
    const { a, b } = db.config.nombres;
    abrirModal(`<h2>¡Hola! 🌿</h2><p class="hint">¿Quién usa este teléfono? Así cada gasto que cargues sale a tu nombre (se puede cambiar en cada uno).</p>
      <div class="row"><button class="btn" data-yo="a">${esc(a)}</button><button class="btn" data-yo="b">${esc(b)}</button></div>`);
    $$('[data-yo]').forEach(x => x.addEventListener('click', () => {
      db.local.yo = x.dataset.yo; formMov.quien = x.dataset.yo; guardar('local'); cerrarModal(); pintarChips();
    }));
  }

  ponerTema(temaActual());
  pedirMemoriaPersistente();
  irA('cargar');
  marcarEstadoSync();
  sincronizar(true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(true); });
  window.addEventListener('online', () => sincronizar(true));

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
