/* ============================================================
   Gráficos dibujados a mano en SVG: sin librerías, andan sin señal.

   Reglas que se respetan (para que se lean bien):
   · Cada categoría tiene SU color (--s1…--s8); "Otros" va en gris (--s0).
     El color sigue a la cosa, no al puesto: el auto no cambia de color
     porque un mes gastaron más en comida.
   · Siempre hay leyenda con nombre, % y monto: el color nunca es lo único
     que dice qué es (daltonismo, impresión en blanco y negro).
   · Al tocar o pasar el mouse por una porción o una barra aparece el dato.
   ============================================================ */

const NS = 'http://www.w3.org/2000/svg';

/* ---------- Cartelito al tocar ---------- */
function ponerTooltip(el, texto) {
  el.dataset.tip = texto;
  el.classList.add('con-tip');
}
function mostrarTip(e) {
  const el = e.target.closest('.con-tip');
  const tip = $('#tooltip');
  if (!el) { tip.classList.add('hidden'); return; }
  tip.innerHTML = el.dataset.tip;
  tip.classList.remove('hidden');
  const x = e.clientX ?? 0, y = e.clientY ?? 0;
  const ancho = tip.offsetWidth;
  tip.style.left = Math.max(8, Math.min(window.innerWidth - ancho - 8, x - ancho / 2)) + 'px';
  tip.style.top = Math.max(8, y - tip.offsetHeight - 14) + 'px';
}
document.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') mostrarTip(e); });
document.addEventListener('pointerdown', mostrarTip);
window.addEventListener('scroll', () => $('#tooltip').classList.add('hidden'), { passive: true });

/* ---------- Torta (anillo) ----------
   datos: [{ nombre, emoji, valor, color }]. Las que no tienen color se
   juntan en "Otros", y "Otros" va siempre al final. */
function plegarOtros(datos) {
  const con = datos.filter(d => d.color > 0 && d.valor > 0).sort((a, b) => b.valor - a.valor);
  const sin = datos.filter(d => !(d.color > 0) && d.valor > 0);
  const resto = sin.reduce((s, d) => s + d.valor, 0);
  if (resto > 0) {
    con.push({
      nombre: sin.length === 1 ? sin[0].nombre : 'Otros', emoji: sin.length === 1 ? sin[0].emoji : '…',
      valor: resto, color: 0, incluye: sin.map(d => d.nombre)
    });
  }
  return con;
}

function torta(cont, datosCrudos, opciones = {}) {
  cont.innerHTML = '';
  const datos = plegarOtros(datosCrudos);
  const total = datos.reduce((s, d) => s + d.valor, 0);
  if (!total) { cont.innerHTML = vacio(opciones.vacio || 'Todavía no hay gastos este mes.'); return; }

  const R = 90, r = 56, C = 100;   // radio externo, interno (anillo) y centro
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('class', 'torta');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', (opciones.titulo || 'Reparto') + ': ' +
    datos.map(d => `${d.nombre} ${pct(d.valor, total)}%`).join(', '));

  let ang = -Math.PI / 2;
  datos.forEach(d => {
    const a = d.valor / total * Math.PI * 2;
    const el = document.createElementNS(NS, 'path');
    if (datos.length === 1) {
      // Un solo dato: un anillo entero (un arco de 360° no se puede dibujar)
      el.setAttribute('d', `M${C - R},${C} a${R},${R} 0 1,0 ${2 * R},0 a${R},${R} 0 1,0 ${-2 * R},0 Z
        M${C - r},${C} a${r},${r} 0 1,1 ${2 * r},0 a${r},${r} 0 1,1 ${-2 * r},0 Z`);
      el.setAttribute('fill-rule', 'evenodd');
    } else {
      const x1 = C + R * Math.cos(ang), y1 = C + R * Math.sin(ang);
      const x2 = C + R * Math.cos(ang + a), y2 = C + R * Math.sin(ang + a);
      const x3 = C + r * Math.cos(ang + a), y3 = C + r * Math.sin(ang + a);
      const x4 = C + r * Math.cos(ang), y4 = C + r * Math.sin(ang);
      const g = a > Math.PI ? 1 : 0;
      el.setAttribute('d', `M${x1},${y1} A${R},${R} 0 ${g} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${g} 0 ${x4},${y4} Z`);
    }
    el.setAttribute('fill', `var(--s${d.color})`);
    el.setAttribute('class', 'porcion');
    ponerTooltip(el, `<b>${esc(d.emoji)} ${esc(d.nombre)}</b><br>${fmt(d.valor)} · ${pct(d.valor, total)}%` +
      (d.incluye && d.incluye.length > 1 ? `<br><small>${esc(d.incluye.join(', '))}</small>` : ''));
    svg.appendChild(el);
    ang += a;
  });

  const t1 = document.createElementNS(NS, 'text');
  t1.setAttribute('x', C); t1.setAttribute('y', C - 4); t1.setAttribute('class', 'torta-total');
  t1.textContent = fmtCorto(total);
  const t2 = document.createElementNS(NS, 'text');
  t2.setAttribute('x', C); t2.setAttribute('y', C + 16); t2.setAttribute('class', 'torta-sub');
  t2.textContent = opciones.sub || 'en total';
  svg.append(t1, t2);

  const ley = document.createElement('ul');
  ley.className = 'leyenda';
  ley.innerHTML = datos.map(d => `
    <li class="con-tip" data-tip="<b>${esc(d.nombre)}</b><br>${fmt(d.valor)}${d.incluye && d.incluye.length > 1 ? '<br><small>' + esc(d.incluye.join(', ')) + '</small>' : ''}">
      <span class="muestra" style="background:var(--s${d.color})"></span>
      <span class="ley-nom">${esc(d.emoji)} ${esc(d.nombre)}</span>
      <span class="ley-pct">${pct(d.valor, total)}%</span>
      <span class="ley-monto">${fmt(d.valor)}</span>
    </li>`).join('');
  cont.append(svg, ley);
}

/* ---------- Barras horizontales (HTML) ----------
   filas: [{ nombre, valor, color, extra, tope }]. `tope` dibuja una
   marca de presupuesto; si se pasa, la barra queda con borde de aviso. */
function barrasH(cont, filas, opciones = {}) {
  const max = Math.max(...filas.map(f => Math.max(f.valor, f.tope || 0)), 1);
  cont.innerHTML = filas.length ? filas.map(f => {
    const pasado = f.tope && f.valor > f.tope;
    return `<div class="barra-fila con-tip" data-tip="<b>${esc(f.nombre)}</b><br>${fmt(f.valor)}${f.tope ? ' de ' + fmt(f.tope) + ' previstos' : ''}">
      <div class="barra-rot"><span>${esc(f.nombre)}</span><span class="barra-val">${f.extra != null ? f.extra : fmt(f.valor)}</span></div>
      <div class="barra-pista">
        <div class="barra${pasado ? ' pasada' : ''}" style="width:${Math.max(f.valor / max * 100, f.valor ? 1.5 : 0)}%;background:var(--s${f.color || 0})"></div>
        ${f.tope ? `<div class="barra-tope" style="left:${f.tope / max * 100}%"></div>` : ''}
      </div></div>`;
  }).join('') : vacio(opciones.vacio || 'Nada para mostrar.');
}

/* ---------- Columnas por mes ----------
   meses: ['2026-06', …]; series: [{ nombre, color (var css), valores: [] }].
   Columnas agrupadas sobre UN solo eje en pesos. */
function columnas(cont, meses, series, opciones = {}) {
  cont.innerHTML = '';
  const W = 340, H = 190, izq = 46, abajo = 22, arriba = 10;
  const max = Math.max(1, ...series.flatMap(s => s.valores));
  const paso = escalaLinda(max);
  const tope = Math.ceil(max / paso) * paso;
  const alto = H - abajo - arriba;
  const anchoMes = (W - izq) / meses.length;
  const anchoBarra = Math.min(22, (anchoMes - 8) / series.length - 2);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'columnas');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', opciones.titulo || 'Columnas por mes');
  let html = '';
  for (let v = 0; v <= tope; v += paso) {
    const y = arriba + alto - v / tope * alto;
    html += `<line x1="${izq}" x2="${W}" y1="${y}" y2="${y}" class="grilla"/>
      <text x="${izq - 6}" y="${y + 4}" class="eje" text-anchor="end">${fmtCorto(v).replace('$', '')}</text>`;
  }
  meses.forEach((ym, i) => {
    const x0 = izq + i * anchoMes + (anchoMes - series.length * (anchoBarra + 2)) / 2;
    html += `<text x="${izq + i * anchoMes + anchoMes / 2}" y="${H - 6}" class="eje" text-anchor="middle">${nombreMes(ym, true)}</text>`;
    series.forEach((s, j) => {
      const v = s.valores[i] || 0;
      const h = v / tope * alto;
      const x = x0 + j * (anchoBarra + 2);
      const y = arriba + alto - h;
      // Punta redondeada arriba, base recta sobre el eje
      const rr = Math.min(4, h, anchoBarra / 2);
      const d = h > 0 ? `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + anchoBarra - rr},${y} Q${x + anchoBarra},${y} ${x + anchoBarra},${y + rr} L${x + anchoBarra},${y + h} Z` : '';
      html += `<path d="${d}" fill="${s.color}"/>`;
    });
    // Zona de toque: todo el mes, más grande que las barras
    html += `<rect x="${izq + i * anchoMes}" y="${arriba}" width="${anchoMes}" height="${alto}" fill="transparent" class="con-tip zona"
      data-tip="<b>${nombreMes(ym)}</b>${series.map(s => `<br>${esc(s.nombre)}: ${fmt(s.valores[i] || 0)}`).join('')}"/>`;
  });
  html += `<line x1="${izq}" x2="${W}" y1="${arriba + alto}" y2="${arriba + alto}" class="eje-base"/>`;
  svg.innerHTML = html;
  cont.appendChild(svg);

  if (series.length > 1) {
    const ley = document.createElement('div');
    ley.className = 'leyenda-linea';
    ley.innerHTML = series.map(s => `<span><span class="muestra" style="background:${s.color}"></span>${esc(s.nombre)}</span>`).join('');
    cont.appendChild(ley);
  }
}

// Un paso de grilla redondo: 1, 2 o 5 × 10^n, para 3–5 líneas.
function escalaLinda(max) {
  const bruto = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function vacio(texto) {
  return `<div class="vacio"><svg class="adorno adorno-vacio" aria-hidden="true"><use href="#brote"/></svg><p>${esc(texto)}</p></div>`;
}
