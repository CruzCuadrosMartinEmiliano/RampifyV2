/* ===== denuncias.js — RF_32 Atender denuncia de usuario (Administrador): desestimar, alertar, banear o eliminar ===== */
Rampify.ready.then((user) => {
  if (!user) return;
  const { api, MESSAGES: M, CONFIG: { RULES }, ui, esc } = Rampify, $ = (s) => document.querySelector(s);
  const lista = $('[data-form="lista"]'), panel = $('[data-detail]'), form = $('[data-form="resolver"]');
  const selEstado = $('[data-filter="estado"]'), selMotivo = $('[data-filter="motivo"]'), limite = Rampify.createRateLimiter(form);
  const filas = new Map(); let pagina = 1, actual = null, mapa, marca;
  const busy = (on) => form.querySelectorAll('[data-submit]').forEach(b => { if (!on || !form.dataset.locked) b.disabled = on; });
  const badge = (e) => `<span class="badge badge--${e.toLowerCase()}">${esc(e)}</span>`;
  const nombreDe = (n) => n || M.deletedUser;                                  // una cuenta Eliminada ya no tiene nombre
  const cerrar = () => { panel.hidden = true; actual = null; };

  /* ---- Bandeja (flujo básico 1-2, alterno 1) ---- */
  async function cargarLista() {
    const r = await api.denuncias({ estado: selEstado.value, motivo: selMotivo.value, pagina });
    if (!r.ok) return ui.showAlert(lista, 'error', M.complaintsError);
    const d = r.data; filas.clear(); d.denuncias.forEach(x => filas.set(x.id, x));
    $('[data-list]').innerHTML = d.denuncias.map(x => `<tr><td><button class="row-btn" type="button" data-id="${x.id}" aria-current="${!!actual && actual === x.id}">
      <strong>${esc(x.folio)}</strong><span>${esc(x.motivo)}</span><span>${esc(x.fecha)}</span><span>${esc(nombreDe(x.denunciado))}</span></button></td></tr>`).join('');
    $('[data-empty]').hidden = d.denuncias.length > 0; $('[data-empty]').textContent = M.noComplaints;     // alterno 1
    $('[data-page-info]').textContent = `Página ${d.pagina} de ${d.paginas} · ${d.total} denuncia(s)`;
    $('[data-action="prev"]').disabled = d.pagina <= 1; $('[data-action="next"]').disabled = d.pagina >= d.paginas;
  }

  /* ---- Detalle (flujo básico 3) ---- */
  async function abrir(id) {
    ui.clearErrors(form); ui.hideAlert(lista); form.reset(); actual = id;
    document.querySelectorAll('.row-btn').forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.id) === id)));
    const r = await api.denuncia(id);
    if (!r.ok) { cerrar(); ui.showAlert(lista, 'warning', r.data.code === 'NOT_FOUND' ? M.complaintNotFound : M.complaintsError); return cargarLista(); }
    const { denuncia: d, denunciado: u, reporte: x, acciones } = r.data; panel.hidden = false;
    const resolucion = d.estado === 'Pendiente' ? '' : `<dt>Resolución</dt><dd>${esc(d.accion)}${d.comentario_resolucion ? ` — ${esc(d.comentario_resolucion)}` : ''}</dd><dt>Resuelta</dt><dd>${esc(d.fecha_resolucion)} · ${esc(d.administrador || '—')}</dd>`;
    $('[data-d="denuncia"]').innerHTML = `<dt>Motivo</dt><dd>${esc(d.motivo)}</dd><dt>Comentario</dt><dd>${esc(d.comentario || '—')}</dd><dt>Fecha</dt><dd>${esc(d.fecha)}</dd>` +
      `<dt>Denunciante</dt><dd>${esc(nombreDe(d.denunciante))}</dd><dt>Estado</dt><dd>${badge(d.estado)}</dd>${resolucion}`;
    $('[data-d="denunciado"]').innerHTML = `<dt>Nombre</dt><dd>${esc(nombreDe(u.nombre))}</dd><dt>Estado de cuenta</dt><dd>${esc(u.estado)}</dd>` +
      `<dt>Denuncias recibidas</dt><dd>${u.total_denuncias}</dd><dt>Sanciones previas</dt><dd>${u.sanciones}</dd><dt>Alertas previas</dt><dd>${u.alertas}</dd>`;
    $('[data-d="reporte"]').innerHTML = `<dt>Folio</dt><dd>${esc(x.folio)}</dd><dt>Tipo de problema</dt><dd>${esc(x.tipo)}</dd><dt>Descripción</dt><dd>${esc(x.descripcion)}</dd>` +
      `<dt>Ubicación</dt><dd>${x.latitud}, ${x.longitud}</dd><dt>Estado</dt><dd>${esc(x.estado)}${x.eliminado ? ' (eliminado)' : ''}</dd>`;
    const img = $('[data-d="img"]'); img.hidden = !x.tiene_imagen; if (x.tiene_imagen) img.src = `${Rampify.CONFIG.API_BASE_URL}${Rampify.CONFIG.ENDPOINTS.denuncias}/${id}/imagen`;
    if (window.L) {
      if (!mapa) { mapa = L.map($('[data-d="mapa"]')); L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa); }
      if (marca) marca.remove(); marca = L.marker([x.latitud, x.longitud]).addTo(mapa); mapa.setView([x.latitud, x.longitud], 16); setTimeout(() => mapa.invalidateSize(), 50);
    }
    form.hidden = !acciones.puede_resolver;                                       // ya resuelta: solo lectura
    form.elements.accion.innerHTML = '<option value="">Selecciona…</option>' + acciones.disponibles.map(a => `<option>${esc(a)}</option>`).join('');   // alterno 2: solo Desestimar
    const aviso = $('[data-d="aviso"]'); aviso.hidden = !(acciones.puede_resolver && acciones.disponibles.length === 1); aviso.textContent = aviso.hidden ? '' : M.accountNotActive;
    ajustarCampos();
  }

  /* ---- Campos según la resolución: Alertar (mensaje 10-300) · Eliminar (contraseña) ---- */
  function ajustarCampos() {
    const a = form.elements.accion.value;
    $('[data-field="contrasena"]').hidden = a !== 'Eliminar';
    $('[data-label="comentario"]').textContent = a === 'Alertar' ? 'Mensaje de la alerta (de 10 a 300 caracteres)' : 'Comentario (opcional, máximo 300 caracteres)';
    if (a !== 'Eliminar') form.elements.contrasena.value = '';
  }
  form.elements.accion.addEventListener('change', ajustarCampos);

  const mensaje = (c) => ({ ALREADY_RESOLVED: M.complaintResolved, NOT_FOUND: M.complaintNotFound, ACCOUNT_NOT_ACTIVE: M.accountNotActive, ACTION_INVALID: M.actionRequired,
    COMMENT_MAX: M.stateCommentMax, MESSAGE_RANGE: M.alertRange, PASSWORD_REQUIRED: M.required, WRONG_PASSWORD: M.wrongPassword, NETWORK: M.network }[c] || M.unknown);

  /* ---- Resolver (flujo básico 4, alternos 3 y 4) ---- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(form);
    const accion = form.elements.accion.value, comentario = form.elements.comentario.value.trim(), contrasena = form.elements.contrasena.value;
    if (!accion) return ui.setFieldError(form, 'accion', M.actionRequired);
    if (comentario.length > RULES.RESOLVE_COMMENT_MAX) return ui.setFieldError(form, 'comentario', M.stateCommentMax);
    if (accion === 'Alertar' && (comentario.length < RULES.ALERT_MIN || comentario.length > RULES.ALERT_MAX)) return ui.setFieldError(form, 'comentario', M.alertRange);
    if (accion === 'Eliminar' && !contrasena) return ui.setFieldError(form, 'contrasena', M.required);
    if (!confirm(accion === 'Eliminar' ? M.confirmUserDelete : accion === 'Banear' ? M.confirmBan : M.confirmResolve(accion))) return;
    limite.register(); busy(true);
    const r = await api.denunciaResolver(actual, { accion, comentario, ...(accion === 'Eliminar' ? { contrasena } : {}) }); busy(false);
    form.elements.contrasena.value = '';                                          // la contraseña nunca se queda en pantalla
    if (r.ok) { cerrar(); await cargarLista(); return ui.showAlert(lista, 'success', accion === 'Desestimar' ? M.complaintDismissed : M.complaintAttended(accion)); }
    const c = r.data.code;
    if (['ALREADY_RESOLVED', 'NOT_FOUND', 'ACCOUNT_NOT_ACTIVE'].includes(c)) {     // alterno 4 / 2: la denuncia o la cuenta cambió; se actualiza la bandeja
      if (c === 'ACCOUNT_NOT_ACTIVE') { await abrir(actual); return ui.showAlert(form, 'warning', mensaje(c)); }
      cerrar(); await cargarLista(); return ui.showAlert(lista, 'warning', mensaje(c));
    }
    if (c === 'MESSAGE_RANGE') return ui.setFieldError(form, 'comentario', M.alertRange);
    ui.showAlert(form, 'error', mensaje(c));                                      // alterno 3: la denuncia sigue Pendiente
  });

  [selEstado, selMotivo].forEach(s => s.addEventListener('change', () => { pagina = 1; cerrar(); cargarLista(); }));
  document.addEventListener('click', (e) => {
    const fila = e.target.closest('.row-btn'), acc = e.target.closest('[data-action]');
    if (fila) abrir(Number(fila.dataset.id));
    else if (acc && acc.dataset.action === 'prev') { pagina--; cargarLista(); }
    else if (acc && acc.dataset.action === 'next') { pagina++; cargarLista(); }
  });
  cargarLista();
});