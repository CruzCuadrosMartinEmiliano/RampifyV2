/* ===== dashboard.js — RF_31 Consultar dashboard (indicadores, gráficas y mapa de concentración) ===== */
Rampify.ready.then(async (user) => {
  if (!user) return;
  const { api, MESSAGES: M, ui } = Rampify, $ = (s) => document.querySelector(s);
  const form = $('[data-form="filtros"]'), limiter = Rampify.createRateLimiter(form);
  let map, capa, catalogosListos = false;

  const barras = (el, items) => {
    const max = Math.max(1, ...items.map(i => i.total));
    el.innerHTML = items.map(i => `<div class="bar"><span>${i.nombre}</span><div class="bar__track"><div class="bar__fill" style="width:${i.total / max * 100}%"></div></div><span class="bar__value">${i.total}</span></div>`).join('') || '<p class="field__hint">Sin datos.</p>';
  };
  function linea(el, porDia, desde, hasta) {                         // rellena los días sin reportes con 0
    const mapa = Object.fromEntries(porDia.map(d => [d.fecha, d.total])), dias = [];
    for (let d = new Date(desde + 'T00:00:00'); d <= new Date(hasta + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; dias.push([k, mapa[k] || 0]);
    }
    const W = 600, H = 180, max = Math.max(1, ...dias.map(d => d[1])), n = Math.max(dias.length - 1, 1);
    const pts = dias.map((d, i) => `${(i / n * W).toFixed(1)},${(H - d[1] / max * (H - 10) - 5).toFixed(1)}`).join(' ');
    el.innerHTML = `<svg class="line" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Reportes por día"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
      <div class="line__label"><span>${desde}</span><span>Máximo por día: ${max}</span><span>${hasta}</span></div>`;
  }
  function mapa(puntos) {
    if (!window.L) return void ($('[data-map]').textContent = 'No se pudo cargar el mapa.');
    if (!map) { map = L.map($('[data-map]')).setView([19.4326, -99.1332], 11); capa = L.layerGroup().addTo(map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map); }
    capa.clearLayers(); const max = Math.max(1, ...puntos.map(p => p.total));
    puntos.forEach(p => L.circleMarker([p.lat, p.lng], { radius: 6 + 18 * Math.sqrt(p.total / max), color: '#184d3d', weight: 1, fillColor: '#34785f', fillOpacity: .45 })
      .bindTooltip(`${p.total} reporte(s)`).addTo(capa));
    setTimeout(() => map.invalidateSize(), 50);
  }
  function llenarCatalogos(c) {
    if (catalogosListos) return; catalogosListos = true;
    const opts = (l) => '<option value="">Todos</option>' + l.map(x => `<option value="${x.id}">${x.nombre}</option>`).join('');
    form.elements.estado.innerHTML = opts(c.estados); form.elements.tipo.innerHTML = opts(c.tipos);
  }

  async function cargar() {
    ui.hideAlert(form);
    const f = { desde: form.elements.desde.value, hasta: form.elements.hasta.value, estado: form.elements.estado.value, tipo: form.elements.tipo.value };
    if (f.desde && f.hasta && f.hasta < f.desde) return ui.showAlert(form, 'error', M.dateRange);
    limiter.register(); form.querySelectorAll('[data-submit]').forEach(b => { if (!form.dataset.locked) b.disabled = true; });
    const r = await api.dashboard(f);
    if (!form.dataset.locked) form.querySelectorAll('[data-submit]').forEach(b => b.disabled = false);
    if (!r.ok) return ui.showAlert(form, 'error', r.data.code === 'DATE_RANGE' ? M.dateRange : M.dashboardError);
    const d = r.data; llenarCatalogos(d.catalogos);
    form.elements.desde.value = d.desde; form.elements.hasta.value = d.hasta;
    $('[data-kpi="total"]').textContent = d.total; $('[data-kpi="usuarios"]').textContent = d.usuarios_activos;
    barras($('[data-chart="estado"]'), d.por_estado); barras($('[data-chart="tipo"]'), d.por_tipo);
    linea($('[data-chart="dia"]'), d.por_dia, d.desde, d.hasta); mapa(d.puntos);
    if (d.total === 0) ui.showAlert(form, 'warning', M.noData);
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); cargar(); });
  $('[data-action="reset-filtros"]').addEventListener('click', () => { form.reset(); form.elements.desde.value = form.elements.hasta.value = ''; cargar(); });
  cargar();                                                           // al abrir: últimos 30 días (lo calcula el servidor)
});