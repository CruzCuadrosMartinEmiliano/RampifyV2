/* ===== empleados.js — RF_22 suspender · RF_23 dar de baja (Empleado de la asociación) ===== */
Rampify.ready.then((user) => {
  if (!user) return;
  const { api, MESSAGES: M, CONFIG: { RULES }, ui, esc } = Rampify, $ = (s) => document.querySelector(s);
  const lista = $('[data-form="lista"]'), fSusp = $('[data-form="suspender"]'), fBaja = $('[data-form="baja"]'), panel = $('[data-detail]'), selEstado = $('[data-filter="estado"]');
  const limSusp = Rampify.createRateLimiter(fSusp), limBaja = Rampify.createRateLimiter(fBaja);
  const filas = new Map(); let pagina = 1, actual = null;
  const busy = (f, on) => f.querySelectorAll('[data-submit]').forEach(b => { if (!on || !f.dataset.locked) b.disabled = on; });
  const badge = (e) => `<span class="badge badge--${e === 'Activa' ? 'solucionado' : e === 'Suspendida' ? 'pendiente' : 'rechazado'}">${esc(e)}</span>`;
  const cerrar = () => { panel.hidden = true; actual = null; };

  async function cargarLista() {
    const r = await api.empleados({ estado: selEstado.value, pagina });
    if (!r.ok) return ui.showAlert(lista, 'error', M.reportsError);
    const d = r.data; filas.clear(); d.empleados.forEach(x => filas.set(x.id, x));
    $('[data-list]').innerHTML = d.empleados.map(x => `<tr><td><button class="row-btn" type="button" data-id="${x.id}" aria-current="${!!actual && actual.id === x.id}">
      <span>${esc(x.nombre)}</span><span>${esc(x.correo)}</span>${badge(x.estado)}</button></td></tr>`).join('');
    $('[data-empty]').hidden = d.empleados.length > 0; $('[data-empty]').textContent = M.noEmployees;
    $('[data-page-info]').textContent = `Página ${d.pagina} de ${d.paginas} · ${d.total} empleado(s)`;
    $('[data-action="prev"]').disabled = d.pagina <= 1; $('[data-action="next"]').disabled = d.pagina >= d.paginas;
  }
  function abrir(id) {
    actual = filas.get(id); if (!actual) return;
    ui.clearErrors(fSusp); ui.clearErrors(fBaja); fSusp.reset(); ui.hideAlert(lista); panel.hidden = false;
    document.querySelectorAll('.row-btn').forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.id) === id)));
    $('[data-d="nombre"]').textContent = actual.nombre;
    $('[data-d="facts"]').innerHTML = `<dt>Correo</dt><dd>${esc(actual.correo)}</dd><dt>Estado</dt><dd>${badge(actual.estado)}</dd><dt>Registro</dt><dd>${esc(actual.registro)}</dd>` +
      (actual.suspendido_hasta ? `<dt>Suspendida hasta</dt><dd>${esc(actual.suspendido_hasta)} 00:00</dd>` : '');
    fSusp.hidden = actual.estado_id !== 1;                                  // solo se suspenden cuentas Activa
    fBaja.hidden = ![1, 3].includes(actual.estado_id);                      // se da de baja a cuentas Activa o Suspendida
  }
  const mensaje = (c) => ({ ONLY_ACTIVE: M.onlyActive, DURATION_RANGE: M.durationRange, REASON_INVALID: M.reasonRequired, ALREADY_DELETED: M.alreadyDeleted,
    INVALID_STATE: M.invalidAccountState, NOT_FOUND: M.reportNotFound, NETWORK: M.network }[c] || M.unknown);
  async function resultado(form, r, okMsg) {
    if (r.ok) { cerrar(); await cargarLista(); return ui.showAlert(lista, 'success', okMsg); }
    const c = r.data.code;
    if (['ONLY_ACTIVE', 'ALREADY_DELETED', 'INVALID_STATE', 'NOT_FOUND'].includes(c)) { cerrar(); await cargarLista(); return ui.showAlert(lista, 'warning', mensaje(c)); }   // la cuenta cambió: se actualiza la lista
    ui.showAlert(form, 'error', mensaje(c));
  }
  fSusp.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fSusp);
    const motivo = fSusp.elements.motivo.value, dias = Number(fSusp.elements.dias.value);
    if (!motivo) return ui.showAlert(fSusp, 'error', M.reasonRequired);
    if (!Number.isInteger(dias) || dias < RULES.SUSPEND_MIN_DAYS || dias > RULES.SUSPEND_MAX_DAYS) return ui.showAlert(fSusp, 'error', M.durationRange);   // flujo alterno 2
    limSusp.register(); busy(fSusp, true);
    const r = await api.empSuspender(actual.id, { motivo, dias }); busy(fSusp, false); resultado(fSusp, r, M.suspended);
  });
  fBaja.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fBaja);
    if (!confirm(M.confirmBaja)) return;                                    // confirmación cancelada: sin cambios
    limBaja.register(); busy(fBaja, true);
    const r = await api.empBaja(actual.id); busy(fBaja, false); resultado(fBaja, r, M.dadaDeBaja);
  });
  selEstado.addEventListener('change', () => { pagina = 1; cerrar(); cargarLista(); });
  document.addEventListener('click', (e) => {
    const fila = e.target.closest('.row-btn'), acc = e.target.closest('[data-action]');
    if (fila) abrir(Number(fila.dataset.id));
    else if (acc && acc.dataset.action === 'prev') { pagina--; cargarLista(); }
    else if (acc && acc.dataset.action === 'next') { pagina++; cargarLista(); }
  });
  cargarLista();
});