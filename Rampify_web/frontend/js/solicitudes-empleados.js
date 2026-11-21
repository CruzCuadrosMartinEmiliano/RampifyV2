/* ===== solicitudes-empleados.js — RF_21 aprobar o rechazar peticiones de Empleado de la asociación ===== */
Rampify.ready.then((user) => {
  if (!user) return;
  const { api, MESSAGES: M, CONFIG: { RULES }, ui, esc } = Rampify, $ = (s) => document.querySelector(s);
  const lista = $('[data-form="lista"]'), fAprobar = $('[data-form="aprobar"]'), fRechazo = $('[data-form="rechazo"]'), panel = $('[data-detail]');
  const limAprobar = Rampify.createRateLimiter(fAprobar), limRechazo = Rampify.createRateLimiter(fRechazo);
  const filas = new Map(); let pagina = 1, actual = null;
  const busy = (f, on) => f.querySelectorAll('[data-submit]').forEach(b => { if (!on || !f.dataset.locked) b.disabled = on; });
  const cerrar = () => { panel.hidden = true; actual = null; };

  async function cargarLista() {
    const r = await api.empSolicitudes(pagina);
    if (!r.ok) return ui.showAlert(lista, 'error', M.reportsError);
    const d = r.data; filas.clear(); d.solicitudes.forEach(s => filas.set(s.id, s));
    $('[data-list]').innerHTML = d.solicitudes.map(s => `<tr><td><button class="row-btn" type="button" data-id="${s.id}" aria-current="${!!actual && actual.id === s.id}">
      <span>${esc(s.nombre)}</span><span>${esc(s.correo)}</span><span>${esc(s.fecha.slice(0, 10))}</span></button></td></tr>`).join('');
    $('[data-empty]').hidden = d.solicitudes.length > 0; $('[data-empty]').textContent = M.noEmpRequests;
    $('[data-page-info]').textContent = `Página ${d.pagina} de ${d.paginas} · ${d.total} pendiente(s)`;
    $('[data-action="prev"]').disabled = d.pagina <= 1; $('[data-action="next"]').disabled = d.pagina >= d.paginas;
  }
  function abrir(id) {
    actual = filas.get(id); if (!actual) return;
    ui.clearErrors(fAprobar); ui.clearErrors(fRechazo); fRechazo.reset(); ui.hideAlert(lista); panel.hidden = false;
    document.querySelectorAll('.row-btn').forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.id) === id)));
    $('[data-d="nombre"]').textContent = actual.nombre;
    $('[data-d="facts"]').innerHTML = `<dt>Correo</dt><dd>${esc(actual.correo)}</dd><dt>Solicitada</dt><dd>${esc(actual.fecha)}</dd>`;
  }
  async function resuelta(form, r, okMsg) {
    if (r.ok) { cerrar(); await cargarLista(); return ui.showAlert(lista, r.data.correo_enviado === false ? 'warning' : 'success', r.data.correo_enviado === false ? `${okMsg} ${M.mailFailed}` : okMsg); }
    const c = r.data.code;
    if (c === 'REQUEST_RESOLVED' || c === 'NOT_FOUND') { cerrar(); await cargarLista(); return ui.showAlert(lista, 'warning', M.petitionResolved); }   // flujo alterno 1
    ui.showAlert(form, 'error', c === 'REASON_RANGE' ? M.reasonRange : c === 'NETWORK' ? M.network : M.unknown);
  }
  fAprobar.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fAprobar); limAprobar.register(); busy(fAprobar, true);
    const r = await api.empAprobar(actual.id); busy(fAprobar, false); resuelta(fAprobar, r, M.empApproved);
  });
  fRechazo.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fRechazo);
    const motivo = fRechazo.elements.motivo.value.trim();
    if (motivo.length < RULES.REJECT_MIN || motivo.length > RULES.REJECT_MAX) return ui.showAlert(fRechazo, 'error', M.reasonRange);      // flujo alterno 2
    limRechazo.register(); busy(fRechazo, true);
    const r = await api.empRechazar(actual.id, { motivo }); busy(fRechazo, false); resuelta(fRechazo, r, M.empRejected);
  });
  document.addEventListener('click', (e) => {
    const fila = e.target.closest('.row-btn'), acc = e.target.closest('[data-action]');
    if (fila) abrir(Number(fila.dataset.id));
    else if (acc && acc.dataset.action === 'prev') { pagina--; cargarLista(); }
    else if (acc && acc.dataset.action === 'next') { pagina++; cargarLista(); }
  });
  cargarLista();
});