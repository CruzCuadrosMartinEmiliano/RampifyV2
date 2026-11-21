/* ===== reportes.js — RF_10 consultar · RF_11 actualizar estado (Empleado) · RF_13 rechazar (Administrador) ===== */
Rampify.ready.then((user) => {
  if (!user) return;
  const { api, MESSAGES: M, CONFIG: { RULES }, ui, esc } = Rampify, $ = (s) => document.querySelector(s);
  const fFiltros = $('[data-form="filtros"]'), fEstado = $('[data-form="estado"]'), fRechazo = $('[data-form="rechazo"]'), fEliminar = $('[data-form="eliminar"]'), panel = $('[data-detail]');
  const bloqueDen = $('[data-denuncia]'), fDen = $('[data-form="denuncia"]'), limDen = fDen && Rampify.createRateLimiter(fDen);   // solo existe en la pantalla del Empleado
  const limFiltros = Rampify.createRateLimiter(fFiltros), limEstado = Rampify.createRateLimiter(fEstado), limRechazo = Rampify.createRateLimiter(fRechazo), limEliminar = Rampify.createRateLimiter(fEliminar);
  let pagina = 1, seleccionado = null, mapa, marca, catalogosListos = false;
  const badge = (e) => `<span class="badge badge--${e.toLowerCase().split(' ')[0]}">${esc(e)}</span>`;
  const opts = (l, todos) => (todos ? '<option value="">Todos</option>' : '') + l.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
  const busy = (form, on) => form.querySelectorAll('[data-submit]').forEach(b => { if (!on || !form.dataset.locked) b.disabled = on; });

  /* ---- Lista (RF_10) ---- */
  async function cargarLista() {
    ui.hideAlert(fFiltros);
    const f = { desde: fFiltros.elements.desde.value, hasta: fFiltros.elements.hasta.value, folio: fFiltros.elements.folio.value.trim(),
                estado: fFiltros.elements.estado.value, tipo: fFiltros.elements.tipo.value, pagina };
    if (f.desde && f.hasta && f.hasta < f.desde) return ui.showAlert(fFiltros, 'error', M.dateRange);
    limFiltros.register(); busy(fFiltros, true);
    const r = await api.reportes(f); busy(fFiltros, false);
    if (!r.ok) return ui.showAlert(fFiltros, 'error', r.data.code === 'DATE_RANGE' ? M.dateRange : M.reportsError);
    const d = r.data;
    if (!catalogosListos) { catalogosListos = true; fFiltros.elements.estado.innerHTML = opts(d.catalogos.estados, true); fFiltros.elements.tipo.innerHTML = opts(d.catalogos.tipos, true); }
    $('[data-list]').innerHTML = d.reportes.map(x => `<tr><td><button class="row-btn" type="button" data-id="${x.id}" aria-current="${x.id === seleccionado}">
      <strong>${esc(x.folio)}</strong><span>${esc(x.tipo)}</span><span>${esc(x.fecha)}</span>${badge(x.estado)}</button></td></tr>`).join('');
    $('[data-empty]').hidden = d.reportes.length > 0; if (!d.reportes.length) $('[data-empty]').textContent = M.noReports;
    $('[data-page-info]').textContent = `Página ${d.pagina} de ${d.paginas} · ${d.total} reporte(s)`;
    $('[data-action="prev"]').disabled = d.pagina <= 1; $('[data-action="next"]').disabled = d.pagina >= d.paginas;
  }

  /* ---- Detalle (RF_10) y acciones (RF_11 / RF_13) ---- */
  async function abrirDetalle(id) {
    seleccionado = id; ui.clearErrors(fEstado); ui.clearErrors(fRechazo); ui.clearErrors(fEliminar);
    document.querySelectorAll('.row-btn').forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.id) === id)));
    const r = await api.reporte(id);
    if (!r.ok) { panel.hidden = true; return ui.showAlert(fFiltros, 'error', r.data.code === 'NOT_FOUND' ? M.reportNotFound : M.reportsError); }
    const { reporte: x, historial, acciones } = r.data; panel.hidden = false;
    $('[data-d="folio"]').textContent = x.folio;
    $('[data-d="facts"]').innerHTML = `<dt>Tipo</dt><dd>${esc(x.tipo)}</dd><dt>Estado</dt><dd>${badge(x.estado)}</dd><dt>Creado</dt><dd>${esc(x.fecha)}</dd><dt>Autor</dt><dd>${esc(x.autor)}</dd>
      <dt>Ubicación</dt><dd>${x.latitud}, ${x.longitud}</dd><dt>Descripción</dt><dd>${esc(x.descripcion)}</dd>`;
    const img = $('[data-d="img"]'); img.hidden = !x.tiene_imagen; if (x.tiene_imagen) img.src = `${Rampify.CONFIG.API_BASE_URL}${Rampify.CONFIG.ENDPOINTS.reportes}/${id}/imagen`;
    $('[data-d="historial"]').innerHTML = historial.map(h => `<li><strong>${esc(h.estado_anterior || 'Creado')} → ${esc(h.estado_nuevo)}</strong> <small>${esc(h.fecha)} · ${esc(h.responsable)}</small>
      ${h.criterio ? `<br><small>Criterio: ${esc(h.criterio)}</small>` : ''}${h.comentario ? `<br>${esc(h.comentario)}` : ''}</li>`).join('') || '<li>Sin movimientos.</li>';
    if (window.L) {
      if (!mapa) { mapa = L.map($('[data-d="mapa"]')); L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa); }
      if (marca) marca.remove(); marca = L.marker([x.latitud, x.longitud]).addTo(mapa); mapa.setView([x.latitud, x.longitud], 16); setTimeout(() => mapa.invalidateSize(), 50);
    }
    fEstado.hidden = !acciones.estados_disponibles.length;                         // RF_11: solo opciones de transición válidas
    fEstado.elements.estado.innerHTML = '<option value="">Selecciona…</option>' + opts(acciones.estados_disponibles); fEstado.reset();
    fRechazo.hidden = !acciones.puede_rechazar;                                    // RF_13: solo si está Pendiente
    fRechazo.elements.id_criterio.innerHTML = '<option value="">Selecciona…</option>' + opts(acciones.criterios); fRechazo.reset();
    fEliminar.hidden = !acciones.puede_eliminar;                                   // RF_12 Forma 2: solo el administrador
    fEliminar.elements.id_criterio.innerHTML = '<option value="">Selecciona el motivo…</option>' + opts(acciones.criterios); fEliminar.reset();
    if (bloqueDen) { bloqueDen.hidden = !acciones.puede_denunciar; fDen.hidden = true; fDen.reset(); ui.clearErrors(fDen); }   // botón "Reportar usuario por infracción" (solo Empleado)
  }

  const mensajeError = (c) => ({ INVALID_TRANSITION: M.transitionInvalid, REPORT_LOCKED: M.reportLocked, NOT_FOUND: M.reportNotFound, NOT_PENDING: M.onlyPending, REPORT_DELETED: M.reportDeleted,
    COMMENT_RANGE: M.rejectRange, COMMENT_TOO_LONG: M.stateCommentMax, CRITERIA_INVALID: M.criteriaRequired, NETWORK: M.network }[c] || M.unknown);

  fEstado.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fEstado);
    const estado = fEstado.elements.estado.value, comentario = fEstado.elements.comentario.value.trim();
    if (!estado) return ui.showAlert(fEstado, 'error', M.stateRequired);
    if (comentario.length > RULES.STATE_COMMENT_MAX) return ui.showAlert(fEstado, 'error', M.stateCommentMax);
    limEstado.register(); busy(fEstado, true);
    const r = await api.reporteEstado(seleccionado, { estado: Number(estado), comentario }); busy(fEstado, false);
    if (!r.ok) return ui.showAlert(fEstado, 'error', mensajeError(r.data.code));
    await abrirDetalle(seleccionado); ui.showAlert(fEstado, 'success', M.stateUpdated); cargarLista();
  });
  fRechazo.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fRechazo);
    const id_criterio = Number(fRechazo.elements.id_criterio.value), comentario = fRechazo.elements.comentario.value.trim();
    if (!id_criterio) return ui.showAlert(fRechazo, 'error', M.criteriaRequired);
    if (comentario.length < RULES.REJECT_MIN || comentario.length > RULES.REJECT_MAX) return ui.showAlert(fRechazo, 'error', M.rejectRange);
    limRechazo.register(); busy(fRechazo, true);
    const r = await api.reporteRechazar(seleccionado, { id_criterio, comentario }); busy(fRechazo, false);
    if (!r.ok) return ui.showAlert(fRechazo, 'error', mensajeError(r.data.code));
    await abrirDetalle(seleccionado); ui.showAlert(fRechazo, 'success', M.reportRejected); cargarLista();
  });

  fEliminar.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fEliminar);
    const id_criterio = Number(fEliminar.elements.id_criterio.value);
    if (!id_criterio) return ui.showAlert(fEliminar, 'error', M.criteriaRequired);
    if (!confirm(M.confirmDelete)) return;                                         // confirmación cancelada: no se altera nada
    limEliminar.register(); busy(fEliminar, true);
    const r = await api.reporteEliminar(seleccionado, { id_criterio }); busy(fEliminar, false);
    if (!r.ok && r.data.code !== 'REPORT_DELETED') return ui.showAlert(fEliminar, 'error', mensajeError(r.data.code));
    panel.hidden = true; seleccionado = null; await cargarLista();
    ui.showAlert(fFiltros, r.ok ? 'success' : 'warning', r.ok ? M.reportDeleteDone : M.reportDeleted);
  });
  if (fDen) fDen.addEventListener('submit', async (e) => {                         // Reportar usuario por infracción → denuncia para RF_32
    e.preventDefault(); ui.clearErrors(fDen);
    const motivo = fDen.elements.motivo.value, comentario = fDen.elements.comentario.value.trim();
    if (!motivo) return ui.setFieldError(fDen, 'motivo', M.reportUserReason);
    if (comentario.length > RULES.REPORT_USER_COMMENT_MAX) return ui.setFieldError(fDen, 'comentario', M.stateCommentMax);
    if (!confirm(M.confirmReportUser)) return;
    limDen.register(); busy(fDen, true);
    const r = await api.denunciarUsuario({ id_reporte: seleccionado, motivo, comentario }); busy(fDen, false);
    if (r.ok) { fDen.reset(); fDen.hidden = true; return ui.showAlert(fFiltros, 'success', M.reportUserSent); }
    const c = r.data.code, msg = { ALREADY_REPORTED: M.alreadyReported, USER_DELETED: M.cannotReportUser, NOT_APP_USER: M.cannotReportUser, NOT_FOUND: M.reportNotFound,
      REASON_INVALID: M.reportUserReason, COMMENT_MAX: M.stateCommentMax, NETWORK: M.network }[c] || M.unknown;
    ui.showAlert(fDen, c === 'ALREADY_REPORTED' ? 'warning' : 'error', msg);
  });
  fFiltros.addEventListener('submit', (e) => { e.preventDefault(); pagina = 1; cargarLista(); });
  document.addEventListener('click', (e) => {
    const fila = e.target.closest('.row-btn'), acc = e.target.closest('[data-action]');
    if (fila) abrirDetalle(Number(fila.dataset.id));
    else if (acc && acc.dataset.action === 'prev') { pagina--; cargarLista(); }
    else if (acc && acc.dataset.action === 'next') { pagina++; cargarLista(); }
    else if (acc && acc.dataset.action === 'abrir-denuncia') { fDen.hidden = !fDen.hidden; if (!fDen.hidden) fDen.elements.motivo.focus(); }
    else if (acc && acc.dataset.action === 'reset-filtros') { fFiltros.reset(); pagina = 1; cargarLista(); }
  });
  cargarLista();
});