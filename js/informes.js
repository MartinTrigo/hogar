/* ============================================================
   Pestaña Informes: varios meses juntos, para ver la tendencia,
   mirar una categoría de cerca (el auto, la comida), hacer las cuentas
   entre los dos e imprimir o bajar todo.
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
  pintarCuentas(meses, gastos);
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

/* Cuentas entre ustedes. Entran los gastos del hogar que pagó cada uno de
   su bolsillo (no los de la cuenta común, que ya son de los dos, ni los
   marcados personales). Si "a" tiene que poner el r % del total:
     le toca a "a" = (lo que pagó a + lo que pagó b) × r
     diferencia    = le toca a "a" − lo que pagó a
   Positiva: "a" le debe a "b" esa plata. Negativa: al revés. */
function pintarCuentas(meses, gastos) {
  const { a, b } = db.config.nombres;
  const r = (db.config.reparto ?? 50) / 100;
  let acum = 0;
  const filas = meses.map(ym => {
    const g = gastos.filter(m => mesDe(m.fecha) === ym && !m.personal);
    const pa = suma(g.filter(m => m.quien === 'a')), pb = suma(g.filter(m => m.quien === 'b'));
    const dif = (pa + pb) * r - pa;
    acum += dif;
    return { ym, pa, pb, dif };
  }).filter(f => f.pa || f.pb);
  if (!filas.length) { $('#i-cuentas').innerHTML = vacio('No hay gastos pagados por cada uno en este período.'); return; }
  const quien = d => d > 0 ? `${esc(a)} → ${esc(b)}` : `${esc(b)} → ${esc(a)}`;
  $('#i-cuentas').innerHTML = `
    <p class="ritmo">Reparto acordado: ${esc(a)} ${Math.round(r * 100)}% · ${esc(b)} ${Math.round(100 - r * 100)}%.</p>
    <table class="tabla"><thead><tr><th></th><th>pagó ${esc(a)}</th><th>pagó ${esc(b)}</th><th>para emparejar</th></tr></thead><tbody>
    ${filas.map(f => `<tr><td>${nombreMes(f.ym, true)}</td><td>${fmt(f.pa)}</td><td>${fmt(f.pb)}</td>
      <td>${Math.abs(f.dif) < 1 ? 'parejos' : quien(f.dif) + ' ' + fmt(Math.abs(f.dif))}</td></tr>`).join('')}
    </tbody></table>
    <p class="saldo-final">${Math.abs(acum) < 1 ? 'En todo el período quedaron parejos 👌'
      : `En todo el período: <b>${quien(acum)} ${fmt(Math.abs(acum))}</b>`}</p>
    <p class="hint">No entran los gastos de la cuenta común ni los marcados como personales.</p>`;
}

function bajarCSV() {
  const meses = mesesDelRango();
  const filas = movsVivos().filter(m => meses.includes(mesDe(m.fecha))).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cab = ['fecha', 'tipo', 'categoria', 'detalle', 'monto', 'quien', 'medio', 'fijo', 'personal', 'nota'];
  // Punto y coma y coma decimal: así lo abre bien el Excel en castellano
  const csv = '﻿' + [cab.join(';'), ...filas.map(m => [m.fecha, m.tipo, cat(m.cat).nombre, m.detalle, String(m.monto).replace('.', ','),
    nombreQuien(m.quien), nombreMedio(m.medio), m.fijo ? 'sí' : '', m.personal ? 'sí' : '', m.nota].map(csvCell).join(';'))].join('\n');
  descargar(`hogar_${meses[0]}_a_${meses[meses.length - 1]}.csv`, csv, 'text/csv;charset=utf-8');
}
