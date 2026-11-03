/* ============================================================
   Arranque y navegación entre pestañas.
   ============================================================ */

const VERSION_APP = '1.2 · 05/11/2026';
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

  initInstalar();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

/* ---------- Instalar como app ----------
   Chrome avisa con `beforeinstallprompt` cuando la app se puede instalar;
   se guarda ese aviso y se usa al tocar "Instalar". Si no llega (ya está
   instalada, otro navegador, iPhone) se explica cómo hacerlo a mano.
   Hasta la versión 1.1 el ícono era solo SVG y Android no podía instalarla
   de verdad: hacía un acceso directo y después decía "ya instalada". */
let avisoInstalar = null;
const enModoApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function initInstalar() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    avisoInstalar = e;
    let dijoNo = false;
    try { dijoNo = Number(localStorage.getItem('hogar_instalar_no') || 0) > Date.now() - 7 * 86400000; } catch (err) {}
    $('#banner-instalar').classList.toggle('hidden', dijoNo);
    pintarInstalar();
  });
  window.addEventListener('appinstalled', () => {
    avisoInstalar = null;
    $('#banner-instalar').classList.add('hidden');
    toast('HOGAR instalada ✓');
    pintarInstalar();
  });
  $$('[data-instalar]').forEach(b => b.addEventListener('click', instalar));
  $('#banner-instalar-no').addEventListener('click', () => {
    $('#banner-instalar').classList.add('hidden');
    try { localStorage.setItem('hogar_instalar_no', String(Date.now())); } catch (e) {}
  });
  pintarInstalar();
}

async function instalar() {
  if (avisoInstalar) {
    avisoInstalar.prompt();
    const r = await avisoInstalar.userChoice;
    if (r.outcome === 'accepted') avisoInstalar = null;
    pintarInstalar();
    return;
  }
  abrirModal(`<h2>Instalar HOGAR</h2>
    <p><b>En Android (Chrome):</b> menú ⋮ arriba a la derecha → <b>Instalar app</b>
      (o "Agregar a pantalla de inicio" → Instalar).</p>
    <p><b>Si Chrome dice que ya está instalada</b> y en la pantalla de inicio tienen un
      ícono viejo de HOGAR: mantenerlo apretado → <b>Quitar</b> o Desinstalar, cerrar
      Chrome del todo, volver a abrir martintrigo.github.io/hogar y probar de nuevo.
      Los datos están adentro de Chrome, no en el ícono.</p>
    <p class="aviso aviso-mal">⚠ Si al quitarlo pregunta <b>si borrar también los datos del sitio, decir que NO</b>:
      el sitio es el mismo que el de AMA y se borrarían los datos de las dos apps.</p>
    <p><b>En iPhone (Safari):</b> botón Compartir → <b>Agregar a inicio</b>.</p>
    <button class="btn" id="cerrar-ayuda">Entendido</button>`);
  $('#cerrar-ayuda').addEventListener('click', cerrarModal);
}

function pintarInstalar() {
  const ya = enModoApp();
  $('#btn-instalar').classList.toggle('hidden', ya);
  $('#instalar-estado').textContent = ya ? '✓ Estás usando HOGAR instalada como app.'
    : avisoInstalar ? 'Se instala como cualquier aplicación: ícono propio, abre sin la barra de Chrome y sin señal.'
    : 'Si no aparece la ventana de instalar, el botón explica cómo hacerlo desde el menú de Chrome.';
}
