/* ============================================================
   Las vetas de la madera, dibujadas UNA vez.

   Las vetas salen de un ruido de SVG (feTurbulence) estirado a lo largo,
   con anillos sacados de las curvas de nivel del ruido. Antes ese filtro
   iba directo como fondo en el CSS, y el teléfono lo volvía a calcular en
   cada cuadro del scroll: la app se arrastraba (05/11/2026).
   Ahora se pinta una vez en un canvas al abrir (o al elegir un tema de
   madera), se guarda como imagen y el fondo es esa imagen repetida, que
   el scroll solo desplaza.
   ============================================================ */

const ANCHO_MADERA = 720, ALTO_MADERA = 450;   // 450 = tres tablas de 150 px
let maderaLista = null;

const SVG_MADERA = `<svg xmlns='http://www.w3.org/2000/svg' width='${ANCHO_MADERA}' height='${ALTO_MADERA}'>
  <filter id='v' x='0' y='0' width='100%' height='100%'>
    <feTurbulence type='fractalNoise' baseFrequency='0.004 0.03' numOctaves='3' seed='11' stitchTiles='stitch'/>
    <feComponentTransfer><feFuncR type='table' tableValues='0 .9 0 .9 0 .9 0 .9 0 .9 0 .9 0'/></feComponentTransfer>
    <feColorMatrix values='0 0 0 0 .22  0 0 0 0 .12  0 0 0 0 .04  .28 0 0 0 0'/>
  </filter>
  <filter id='f' x='0' y='0' width='100%' height='100%'>
    <feTurbulence type='fractalNoise' baseFrequency='0.012 0.55' numOctaves='2' seed='3' stitchTiles='stitch'/>
    <feColorMatrix values='0 0 0 0 .2  0 0 0 0 .1  0 0 0 0 .03  .55 0 0 0 -.18'/>
  </filter>
  <rect width='100%' height='100%' filter='url(#v)'/>
  <rect width='100%' height='100%' filter='url(#f)'/>
</svg>`;

function prepararMadera() {
  const tema = document.documentElement.dataset.tema;
  if (tema !== 'madera' && tema !== 'nogal') return;
  if (maderaLista) return;
  maderaLista = new Promise(ok => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = ANCHO_MADERA; c.height = ALTO_MADERA;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      // Las juntas entre tablas: una línea oscura y un filo de luz debajo
      for (let y = 147; y < ALTO_MADERA; y += 150) {
        g.fillStyle = 'rgba(30,15,5,.35)'; g.fillRect(0, y, ANCHO_MADERA, 2);
        g.fillStyle = 'rgba(255,240,215,.12)'; g.fillRect(0, y + 2, ANCHO_MADERA, 1);
      }
      c.toBlob(b => {
        if (b) document.documentElement.style.setProperty('--madera-png', `url(${URL.createObjectURL(b)})`);
        ok();
      });
    };
    img.onerror = ok;   // sin vetas, la madera queda lisa: se ve bien igual
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SVG_MADERA);
  });
}
