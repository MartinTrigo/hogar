/* ============================================================
   Pestaña Informes: varios meses juntos, para ver la tendencia,
   mirar una categoría de cerca (el auto, la comida), seguir el ahorro
   e imprimir o bajar todo.
   ============================================================ */

function initInformes() {
  $('#i-rango').addEventListener('change', pintarInformes);
  $('#i-cat').addEventListener('change', pintarInformes);
  $('#i-imprimir').addEventListener('click', () => window.print());
  $('#i-csv').addEventListener('click', bajarCSV);
}

function mesesDelRango() {
  const v = $('#i-rango').value, actual = mesDe(hoy());
  if (v === 'anio') {
    const n = Number(actual.slice(5));
    return Array.from({ length: n }, (_, i) => actual.slice(0, 4) + '-' + String(i + 1).padStart(2, '0'));
  }
  return Array.from({ length: Number(v) }, (_, i) => sumarMeses(actual, i - Number(v) + 1));
}

function pintarInformes() {
  const sc = $('#i-cat'), vc = sc.value || 'auto';
  sc.innerHTML = db.config.catsGasto.map(c => `<option value="${c.id}">${esc(c.emoji)} Mirar: ${esc(c.nombre)}</option>`).join('');
  sc.value = db.config.catsGasto.some(c => c.id === vc) ? vc : db.config.catsGasto[0].id;

  const meses = mesesDelRango();
  const enRango = movsVivos().filter(m => meses.includes(mesDe(m.fecha)));
  const gastos = enRango.filter(m => m.tipo === 'gasto'), ingresos = enRango.filter(m => m.tipo === 'ingreso');
  const tG = suma(gastos), tI = suma(ingresos);
  // El promedio se saca sobre los meses que tienen algo: los meses antes
  // de empezar a usar la app no son "meses sin gastos".
  const conDatos = meses.filter(ym => enRango.some(m => mesDe(m.fecha) === ym)).length || 1;

  $('#i-titulo-imp').textContent = `HOGAR · ${nombreMes(meses[0])} a ${nombreMes(meses[meses.length - 1])}`;
  $('#i-kpis').innerHTML = `
    <div class="kpi"><span>Entró</span><b class="pos">${fmtCorto(tI)}</b></div>
    <div class="kpi"><span>Salió</span><b class="gasto">${fmtCorto(tG)}</b></div>
    <div class="kpi"><span>Gasto por mes</span><b>${fmtCorto(tG / conDatos)}</b></div>
    <div class="kpi"><span>Ahorro</span><b class="${tI - tG < 0 ? 'neg' : 'pos'}">${tI ? pct(tI - tG, tI) + '%' : '—'}</b></div>`;

  columnas($('#i-barras'), meses, [
    { nombre: 'Ingresos', color: 'var(--pos)', valores: meses.map(ym => suma(ingresos.filter(m => mesDe(m.fecha) === ym))) },
    { nombre: 'Gastos', color: 'var(--gasto)', valores: meses.map(ym => suma(gastos.filter(m => mesDe(m.fecha) === ym))) }
  ], { titulo: 'Ingresos y gastos por mes' });

  torta($('#i-torta'), agrupar(gastos, 'cat').map(([id, v]) => {
    const c = cat(id);
    return { nombre: c.nombre, emoji: c.emoji, valor: v, color: c.color };
  }), { titulo: 'Gastos del período', sub: 'en el período', vacio: 'No hay gastos en este período.' });

  // Una categoría de cerca
  const c = cat(sc.value);
  const gc = gastos.filter(m => m.cat === c.id);
  $('#i-cat-titulo').textContent = `${c.emoji} ${c.nombre}: ${fmt(suma(gc))} (${pct(suma(gc), tG)}% de los gastos)`;
  columnas($('#i-cat-barras'), meses, [{
    nombre: c.nombre, color: `var(--s${c.color || 0})`,
    valores: meses.map(ym => suma(gc.filter(m => mesDe(m.fecha) === ym)))
  }], { titulo: c.nombre + ' por mes' });
  const porDetalle = agrupar(gc, m => (m.detalle || 'sin detalle').toLowerCase());
  const tc = suma(gc);
  barrasH($('#i-cat-detalle'), porDetalle.map(([d, v]) => ({
    nombre: d.charAt(0).toUpperCase() + d.slice(1), valor: v, color: c.color, extra: `${fmt(v)} · ${pct(v, tc)}%`
  })), { vacio: `No hay gastos de ${c.nombre.toLowerCase()} en este período.` });

  pintarTabla(meses, gastos);
  pintarAhorro(meses, enRango);
}

function pintarTabla(meses, gastos) {
  const ids = agrupar(gastos, 'cat').map(([id]) => id);
  if (!ids.length) { $('#i-tabla').innerHTML = vacio('No hay gastos en este período.'); return; }
  const celda = (id, ym) => suma(gastos.filter(m => m.cat === id && mesDe(m.fecha) === ym));
  $('#i-tabla').innerHTML = `<table class="tabla tabla-meses"><thead><tr><th></th>
    ${meses.map(ym => `<th>${nombreMes(ym, true)}</th>`).join('')}<th>Total</th><th>%</th></tr></thead><tbody>
    ${ids.map(id => {
      const t = suma(gastos.filter(m => m.cat === id));
      return `<tr><td>${esc(cat(id).emoji)} ${esc(cat(id).nombre)}</td>${meses.map(ym => {
        const v = celda(id, ym); return `<td>${v ? fmtCorto(v).replace('$', '') : '·'}</td>`;
      }).join('')}<td><b>${fmtCorto(t).replace('$', '')}</b></td><td>${pct(t, suma(gastos))}%</td></tr>`;
    }).join('')}
    <tr class="total"><td>Total</td>${meses.map(ym => { const v = suma(gastos.filter(m => mesDe(m.fecha) === ym)); return `<td>${v ? fmtCorto(v).replace('$', '') : '·'}</td>`; }).join('')}
      <td>${fmtCorto(suma(gastos)).replace('$', '')}</td><td>100%</td></tr>
    </tbody></table>`;
}

/* Ahorro mes a mes: lo que entró, lo que salió y qué parte quedó.
     ahorro % = (entró − salió) ÷ entró × 100
   Con meta (Ajustes), cada mes dice si llegó. */
function pintarAhorro(meses, enRango) {
  const meta = db.config.metaAhorro || 0;
  const filas = meses.map(ym => {
    const ms = enRango.filter(m => mesDe(m.fecha) === ym);
    const i = suma(ms.filter(m => m.tipo === 'ingreso')), g = suma(ms.filter(m => m.tipo === 'gasto'));
    return { ym, i, g, q: i - g };
  }).filter(f => f.i || f.g);
  if (!filas.length) { $('#i-ahorro').innerHTML = vacio('No hay movimientos en este período.'); return; }
  const tQ = filas.reduce((s, f) => s + f.q, 0), tI = filas.reduce((s, f) => s + f.i, 0);
  $('#i-ahorro').innerHTML = `<table class="tabla"><thead><tr><th></th><th>entró</th><th>salió</th><th>quedó</th><th>ahorro</th></tr></thead><tbody>
    ${filas.map(f => {
      const p = f.i ? pct(f.q, f.i) : null;
      return `<tr><td>${nombreMes(f.ym, true)}</td><td>${fmtCorto(f.i)}</td><td>${fmtCorto(f.g)}</td>
        <td class="${f.q < 0 ? 'neg' : 'pos'}">${f.q < 0 ? '−' : ''}${fmtCorto(Math.abs(f.q))}</td>
        <td>${p == null ? '—' : p + '%'}${meta && p != null ? (p >= meta ? ' ✓' : '') : ''}</td></tr>`;
    }).join('')}
    <tr class="total"><td>Total</td><td>${fmtCorto(tI)}</td><td>${fmtCorto(tI - tQ)}</td>
      <td class="${tQ < 0 ? 'neg' : 'pos'}">${tQ < 0 ? '−' : ''}${fmtCorto(Math.abs(tQ))}</td><td>${tI ? pct(tQ, tI) + '%' : '—'}</td></tr>
    </tbody></table>
    <p class="hint">${meta ? `Meta: guardar el ${meta}% de lo que entra (✓ = la cumplieron).` : 'Pueden poner una meta de ahorro en Ajustes.'}</p>`;
}

function bajarCSV() {
  const meses = mesesDelRango();
  const filas = movsVivos().filter(m => meses.includes(mesDe(m.fecha))).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cab = ['fecha', 'tipo', 'categoria', 'detalle', 'monto', 'quien', 'medio', 'fijo', 'nota'];
  // Punto y coma y coma decimal: así lo abre bien el Excel en castellano
  const csv = '﻿' + [cab.join(';'), ...filas.map(m => [m.fecha, m.tipo, cat(m.cat).nombre, m.detalle, String(m.monto).replace('.', ','),
    nombreQuien(m.quien), nombreMedio(m.medio), m.fijo ? 'sí' : '', m.nota].map(csvCell).join(';'))].join('\n');
  descargar(`hogar_${meses[0]}_a_${meses[meses.length - 1]}.csv`, csv, 'text/csv;charset=utf-8');
}
