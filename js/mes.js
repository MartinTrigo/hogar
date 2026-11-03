/* ============================================================
   Pestaña Mes: cómo viene el mes que se elige (por defecto, el actual).
   ============================================================ */

let mesVisto = mesDe(hoy());

function initMes() {
  $$('.selector-mes [data-mes]').forEach(b => b.addEventListener('click', () => {
    mesVisto = sumarMeses(mesVisto, Number(b.dataset.mes));
    pintarMes();
  }));
}

function pintarMes() {
  const ym = mesVisto;
  const esActual = ym === mesDe(hoy());
  $('#mes-nombre').textContent = nombreMes(ym);
  $('.selector-mes [data-mes="1"]').disabled = esActual;

  const gastos = movsDelMes(ym, 'gasto');
  const ingresos = movsDelMes(ym, 'ingreso');
  const tG = suma(gastos), tI = suma(ingresos), saldo = tI - tG;

  pintarAvisos(ym, gastos);
  const meta = db.config.metaAhorro || 0;

  $('#mes-kpis').innerHTML = `
    <div class="kpi"><span>Entró</span><b class="pos">${fmt(tI)}</b></div>
    <div class="kpi"><span>Salió</span><b class="gasto">${fmt(tG)}</b></div>
    <div class="kpi"><span>Quedó</span><b class="${saldo < 0 ? 'neg' : 'pos'}">${saldo < 0 ? '−' : ''}${fmt(Math.abs(saldo))}</b></div>
    <div class="kpi"><span>Ahorro${meta ? ' (meta ' + meta + '%)' : ''}</span><b class="${!tI ? '' : meta && pct(saldo, tI) < meta ? 'neg' : meta ? 'pos' : ''}">${tI ? pct(saldo, tI) + '%' : '—'}${tI && meta ? (pct(saldo, tI) >= meta ? ' ✓' : '') : ''}</b></div>`;

  torta($('#mes-torta'), agrupar(gastos, 'cat').map(([id, v]) => {
    const c = cat(id);
    return { nombre: c.nombre, emoji: c.emoji, valor: v, color: c.color };
  }), { titulo: 'Gastos de ' + nombreMes(ym), sub: 'gastados' });

  pintarRitmo(ym, gastos, esActual);
  pintarCompara(ym, gastos, esActual);

  pintarPromedio(ym, gastos);

  // Medios de pago
  const porMedio = agrupar(gastos, m => m.medio || 'sin');
  barrasH($('#mes-medios'), porMedio.map(([id, v]) => ({
    nombre: id === 'sin' ? 'Sin decir' : nombreMedio(id), valor: v, color: 0, extra: `${fmt(v)} · ${pct(v, tG)}%`
  })), { vacio: 'Sin gastos este mes.' });
  const cred = suma(gastos.filter(m => m.medio === 'credito'));
  if (cred) $('#mes-medios').insertAdjacentHTML('beforeend', `<p class="hint mt">💳 ${fmt(cred)} con tarjeta de crédito: esa plata sale cuando llega el resumen, no este mes.</p>`);

  // Los más grandes
  const top = gastos.slice().sort((a, b) => b.monto - a.monto).slice(0, 6);
  $('#mes-top').innerHTML = top.length ? top.map(m => filaMov(m)).join('') : vacio('Sin gastos este mes.');
  $$('#mes-top .mov').forEach(b => b.addEventListener('click', () => editarMov(b.dataset.id)));
}

/* Lo que pide atención: gastos fijos sin cargar, papeles por vencer,
   categorías que se pasaron del presupuesto. */
function pintarAvisos(ym, gastos) {
  const avisos = [];

  // Fijos del mes anterior que este mes todavía no aparecen
  const anterior = sumarMeses(ym, -1);
  const fijosAnt = movsVivos().filter(m => m.fijo && mesDe(m.fecha) === anterior);
  const esteMes = movsDelMes(ym);
  const faltan = fijosAnt.filter(f => !esteMes.some(m => m.cat === f.cat &&
    (m.detalle || '').toLowerCase() === (f.detalle || '').toLowerCase() && m.tipo === f.tipo));
  if (faltan.length && ym <= mesDe(hoy())) {
    avisos.push(`<div class="aviso">
      <b>↻ Fijos de ${nombreMes(anterior).split(' ')[0]} que todavía no cargaron</b>
      <ul class="fijos">${faltan.map(f => `<li><label><input type="checkbox" checked data-id="${f.id}">
        ${esc(cat(f.cat).emoji)} ${esc(cat(f.cat).nombre)}${f.detalle ? ' · ' + esc(f.detalle) : ''} <b>${fmt(f.monto)}</b></label></li>`).join('')}</ul>
      <button class="btn btn-chico" id="cargar-fijos">Cargar los marcados</button>
      <small>Se cargan con el mismo monto y fecha de hoy; si cambió (el alquiler sube), después lo corregís en la Lista.</small>
    </div>`);
  }

  // Papeles que vencen en 30 días o ya vencieron
  papelesPorVencer(30).forEach(p => {
    const d = diasHasta(p.vence);
    avisos.push(`<div class="aviso ${d < 0 ? 'aviso-mal' : ''}" data-ir="papeles">
      📄 <b>${esc(p.titulo)}</b> ${d < 0 ? 'venció hace ' + -d + ' días' : d === 0 ? 'vence hoy' : 'vence en ' + d + (d === 1 ? ' día' : ' días')} (${fmtFecha(p.vence)})</div>`);
  });

  // Presupuestos pasados
  const pres = db.config.presupuesto || {};
  agrupar(gastos, 'cat').forEach(([id, v]) => {
    if (pres[id] && v > pres[id]) {
      avisos.push(`<div class="aviso aviso-mal">${esc(cat(id).emoji)} <b>${esc(cat(id).nombre)}</b>: van ${fmt(v)}, ${fmt(v - pres[id])} más de lo previsto (${fmt(pres[id])}).</div>`);
    }
  });

  $('#mes-avisos').innerHTML = avisos.join('');
  $('#cargar-fijos')?.addEventListener('click', () => {
    const ids = $$('#mes-avisos .fijos input:checked').map(i => i.dataset.id);
    const fecha = ym === mesDe(hoy()) ? hoy() : ym + '-01';
    ids.forEach(id => {
      const f = db.movs.find(m => m.id === id);
      guardarMov(Object.assign({}, f, { id: uid(), fecha, nota: f.nota }));
    });
    toast(`${ids.length} fijos cargados ✓`);
    pintarMes();
  });
}

function pintarRitmo(ym, gastos, esActual) {
  const tG = suma(gastos);
  const pres = db.config.presupuesto || {};
  let html = '';
  if (esActual) {
    const dia = new Date().getDate(), dm = diasDelMes(ym);
    /* Proyección: los fijos (alquiler, servicios) se pagan una vez y ya
       están; lo que se estira con los días es lo variable. Por eso:
       fijos + variable ÷ días que pasaron × días del mes. Con pocos días
       es muy gruesa, por eso no se muestra antes del día 5. */
    const fijos = suma(gastos.filter(m => m.fijo));
    const variable = tG - fijos;
    const proy = fijos + variable / dia * dm;
    html += `<p class="ritmo">Van <b>${dia}</b> de ${dm} días. Gasto variable por día: <b>${fmt(variable / dia)}</b>.</p>`;
    if (dia >= 5 && tG) html += `<p class="ritmo">A este ritmo el mes cierra cerca de <b>${fmt(proy)}</b> en gastos.</p>`;
    else if (tG) html += `<p class="hint">La proyección a fin de mes aparece desde el día 5: antes es muy al voleo.</p>`;
  } else {
    html += `<p class="ritmo">Gasto promedio por día: <b>${fmt(tG / diasDelMes(ym))}</b>.</p>`;
  }
  const conPres = Object.keys(pres).filter(id => pres[id] > 0);
  if (conPres.length) {
    const div = document.createElement('div');
    barrasH(div, conPres.map(id => {
      const v = suma(gastos.filter(m => m.cat === id));
      return { nombre: cat(id).emoji + ' ' + cat(id).nombre, valor: v, tope: pres[id], color: cat(id).color, extra: `${fmt(v)} de ${fmt(pres[id])}` };
    }));
    html += `<h3>Presupuesto</h3>` + div.innerHTML;
  } else {
    html += `<p class="hint">Si ponen un presupuesto por categoría (en Ajustes), acá se ve cuánto queda.</p>`;
  }
  $('#mes-ritmo').innerHTML = html;
}

/* Contra el mes anterior, categoría por categoría. Si el mes está en
   curso, se compara contra el anterior HASTA EL MISMO DÍA: comparar 3 días
   de noviembre con octubre entero diría siempre "gastaron menos". */
function pintarCompara(ym, gastos, esActual) {
  const ant = sumarMeses(ym, -1);
  const dia = new Date().getDate();
  let gAnt = movsDelMes(ant, 'gasto');
  if (esActual) gAnt = gAnt.filter(m => Number(m.fecha.slice(8)) <= dia);
  if (!gAnt.length) { $('#mes-compara').innerHTML = vacio(`No hay gastos de ${nombreMes(ant)} para comparar.`); return; }

  const ids = new Set([...gastos, ...gAnt].map(m => m.cat));
  const filas = [...ids].map(id => {
    const a = suma(gastos.filter(m => m.cat === id)), b = suma(gAnt.filter(m => m.cat === id));
    return { id, a, b, d: a - b };
  }).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const tA = suma(gastos), tB = suma(gAnt);
  $('#mes-compara').innerHTML = `
    <p class="ritmo">${esActual ? `Hasta el día ${dia}: ` : ''}${fmt(tA)} contra ${fmt(tB)} de ${MESES[Number(ant.slice(5)) - 1]}
      <b class="${tA > tB ? 'neg' : 'pos'}">(${tA > tB ? '+' : '−'}${fmt(Math.abs(tA - tB))}${tB ? ', ' + (tA > tB ? '+' : '−') + Math.abs(pct(tA - tB, tB)) + '%' : ''})</b></p>
    <table class="tabla"><thead><tr><th></th><th>${nombreMes(ym, true)}</th><th>${nombreMes(ant, true)}</th><th>diferencia</th></tr></thead><tbody>
    ${filas.slice(0, 8).map(f => `<tr><td>${esc(cat(f.id).emoji)} ${esc(cat(f.id).nombre)}</td><td>${fmt(f.a)}</td><td>${fmt(f.b)}</td>
      <td class="${f.d > 0 ? 'neg' : 'pos'}">${f.d > 0 ? '▲ +' : f.d < 0 ? '▼ −' : ''}${fmt(Math.abs(f.d))}</td></tr>`).join('')}
    </tbody></table>`;
}

/* Este mes contra un mes normal: cada categoría con una rayita en lo que
   gastan en promedio por mes (los 3 meses anteriores que tienen gastos).
   Sirve de presupuesto sin tener que inventarlo: si la barra pasa la
   rayita, este mes se fue más plata ahí que de costumbre. En el mes en
   curso la barra se va llenando con los días. */
function pintarPromedio(ym, gastos) {
  const previos = [];
  for (let k = 1; k <= 12 && previos.length < 3; k++) {
    const m = sumarMeses(ym, -k);
    if (movsDelMes(m, 'gasto').length) previos.push(m);
  }
  const cont = $('#mes-promedio');
  if (!previos.length) { cont.innerHTML = vacio('Cuando tengan un mes completo cargado, acá se compara cada categoría con lo normal.'); return; }
  const ant = movsVivos().filter(m => m.tipo === 'gasto' && previos.includes(mesDe(m.fecha)));
  const ids = new Set([...gastos, ...ant].map(m => m.cat));
  const filas = [...ids].map(id => {
    const v = suma(gastos.filter(m => m.cat === id));
    const prom = suma(ant.filter(m => m.cat === id)) / previos.length;
    return { id, v, prom };
  }).sort((a, b) => Math.max(b.v, b.prom) - Math.max(a.v, a.prom));
  barrasH(cont, filas.map(f => ({
    nombre: cat(f.id).emoji + ' ' + cat(f.id).nombre, valor: f.v, tope: f.prom, color: cat(f.id).color,
    extra: `${fmt(f.v)} <small>/ ${fmt(f.prom)}</small>`, tipTope: '<br>un mes normal: ' + fmt(f.prom)
  })));
  const pasadas = filas.filter(f => f.prom && f.v > f.prom * 1.1);
  const tProm = suma(ant) / previos.length;
  cont.insertAdjacentHTML('afterbegin', `<p class="ritmo">Un mes normal gastan <b>${fmt(tProm)}</b>
    <span class="hint">(promedio de ${previos.map(m => nombreMes(m, true)).join(', ')})</span>.</p>`);
  cont.insertAdjacentHTML('beforeend', `<p class="hint">La rayita es el promedio. ${pasadas.length
    ? 'Por arriba de lo normal: <b>' + pasadas.map(f => esc(cat(f.id).nombre)).join(', ') + '</b>. Ahí está lo primero para mirar si quieren ahorrar más.'
    : 'Ninguna categoría está por arriba de lo normal 👌'}</p>`);
}
