/* ===== solicitudes.js — RF_12 Forma 1: aprobar o rechazar solicitudes de eliminación (Administrador) ===== */
Rampify.ready.then((user) => {
  if (!user) return;
  const { api, MESSAGES: M, CONFIG: { RULES }, ui, esc } = Rampify, $ = (s) => document.querySelector(s);
  const lista = $('[data-form="lista"]'), fAprobar = $('[data-form="aprobar"]'), fRechazo = $('[data-form="rechazo"]'), panel = $('[data-detail]');
  const limAprobar = Rampify.createRateLimiter(fAprobar), limRechazo = Rampify.createRateLimiter(fRechazo);
  const filas = new Map(); let pagina = 1, actual = null;
  const busy = (f, on) => f.querySelectorAll('[data-submit]').forEach(b => { if (!on || !f.dataset.locked) b.disabled = on; });

  async function cargarLista() {
    const r = await api.solicitudes(pagina);
    if (!r.ok) return ui.showAlert(lista, 'error', M.reportsError);
    const d = r.data; filas.clear(); d.solicitudes.forEach(s => filas.set(s.id, s));
    $('[data-list]').innerHTML = d.solicitudes.map(s => `<tr><td><button class="row-btn" type="button" data-id="${s.id}" aria-current="${actual && actual.id === s.id}">
      <strong>${esc(s.folio)}</strong><span>${esc(s.motivo)}</span><span>${esc(s.fecha)}</span></button></td></tr>`).join('');
    $('[data-empty]').hidden = d.solicitudes.length > 0; $('[data-empty]').textContent = M.noRequests;
    $('[data-page-info]').textContent = `Página ${d.pagina} de ${d.paginas} · ${d.total} pendiente(s)`;
    $('[data-action="prev"]').disabled = d.pagina <= 1; $('[data-action="next"]').disabled = d.pagina >= d.paginas;
  }
  const cerrar = () => { panel.hidden = true; actual = null; };
  async function abrir(id) {
    const s = filas.get(id); if (!s) return;
    actual = s; ui.clearErrors(fAprobar); ui.clearErrors(fRechazo); fRechazo.reset(); ui.hideAlert(lista);
    document.querySelectorAll('.row-btn').forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.id) === id)));
    const r = await api.reporte(s.id_reporte);
    if (!r.ok) { cerrar(); ui.showAlert(lista, 'warning', r.data.code === 'NOT_FOUND' ? M.reportDeleted : M.reportsError); return cargarLista(); }
    const x = r.data.reporte; panel.hidden = false;
    $('[data-d="folio"]').textContent = x.folio;
    $('[data-d="facts"]').innerHTML = `<dt>Motivo del autor</dt><dd>${esc(s.motivo)}</dd><dt>Solicitada</dt><dd>${esc(s.fecha)}</dd><dt>Autor</dt><dd>${esc(s.autor)}</dd>
      <dt>Tipo</dt><dd>${esc(x.tipo)}</dd><dt>Estado</dt><dd>${esc(x.estado)}</dd><dt>Ubicación</dt><dd>${x.latitud}, ${x.longitud}</dd><dt>Descripción</dt><dd>${esc(x.descripcion)}</dd>`;
    const img = $('[data-d="img"]'); img.hidden = !x.tiene_imagen;
    if (x.tiene_imagen) img.src = `${Rampify.CONFIG.API_BASE_URL}${Rampify.CONFIG.ENDPOINTS.reportes}/${x.id}/imagen`;
  }
  async function resuelta(form, r, okMsg) {                               // resultado común de aprobar / rechazar
    if (r.ok) { cerrar(); await cargarLista(); return ui.showAlert(lista, 'success', okMsg); }
    const c = r.data.code;
    if (c === 'REQUEST_RESOLVED' || c === 'REPORT_DELETED' || c === 'NOT_FOUND') {   // flujo alterno: se actualiza la lista
      cerrar(); await cargarLista(); return ui.showAlert(lista, 'warning', c === 'REPORT_DELETED' ? M.reportDeleted : M.requestResolved);
    }
    ui.showAlert(form, 'error', c === 'REASON_RANGE' ? M.reasonRange : c === 'NETWORK' ? M.network : M.unknown);
  }

  fAprobar.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fAprobar);
    if (!confirm(M.confirmDelete)) return;                                // cancelar no altera nada
    limAprobar.register(); busy(fAprobar, true);
    const r = await api.solicitudAprobar(actual.id); busy(fAprobar, false); resuelta(fAprobar, r, M.requestApproved);
  });
  fRechazo.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fRechazo);
    const motivo = fRechazo.elements.motivo.value.trim();
    if (motivo.length < RULES.REJECT_MIN || motivo.length > RULES.REJECT_MAX) return ui.showAlert(fRechazo, 'error', M.reasonRange);
    limRechazo.register(); busy(fRechazo, true);
    const r = await api.solicitudRechazar(actual.id, { motivo }); busy(fRechazo, false); resuelta(fRechazo, r, M.requestRejected);
  });
  document.addEventListener('click', (e) => {
    const fila = e.target.closest('.row-btn'), acc = e.target.closest('[data-action]');
    if (fila) abrir(Number(fila.dataset.id));
    else if (acc && acc.dataset.action === 'prev') { pagina--; cargarLista(); }
    else if (acc && acc.dataset.action === 'next') { pagina++; cargarLista(); }
  });
  cargarLista();
});