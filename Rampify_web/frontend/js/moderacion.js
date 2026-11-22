/* ===== moderacion.js — RF_28 banear · RF_29 eliminar · RF_30 alertar (Usuario de la app) ===== */
Rampify.ready.then((user) => {
  if (!user) return;
  const { api, MESSAGES: M, CONFIG: { RULES }, ui, esc } = Rampify, $ = (s) => document.querySelector(s);
  const lista = $('[data-form="lista"]'), panel = $('[data-detail]'), selEstado = $('[data-filter="estado"]'), inBuscar = $('[data-filter="q"]');
  const fAlerta = $('[data-form="alertar"]'), fBan = $('[data-form="banear"]'), fDel = $('[data-form="eliminar"]');
  const forms = [fAlerta, fBan, fDel], limites = new Map(forms.map(f => [f, Rampify.createRateLimiter(f)]));
  const filas = new Map(); let pagina = 1, actual = null, temporizador = null;
  const busy = (f, on) => f.querySelectorAll('[data-submit]').forEach(b => { if (!on || !f.dataset.locked) b.disabled = on; });
  const badge = (e) => `<span class="badge badge--${e === 'Activa' ? 'solucionado' : e === 'Suspendida' ? 'pendiente' : 'rechazado'}">${esc(e)}</span>`;
  const nombreDe = (x) => x.nombre || M.deletedUser;                         // una cuenta Eliminada ya no tiene nombre ni correo
  const cerrar = () => { panel.hidden = true; actual = null; };

  async function cargarLista() {
    const r = await api.usuarios({ estado: selEstado.value, q: inBuscar.value.trim(), pagina });
    if (!r.ok) return ui.showAlert(lista, 'error', M.usersError);
    const d = r.data; filas.clear(); d.usuarios.forEach(x => filas.set(x.id, x));
    $('[data-list]').innerHTML = d.usuarios.map(x => `<tr><td><button class="row-btn" type="button" data-id="${x.id}" aria-current="${!!actual && actual.id === x.id}">
      <span>${esc(nombreDe(x))}</span><span>${esc(x.correo || '—')}</span>${badge(x.estado)}</button></td></tr>`).join('');
    $('[data-empty]').hidden = d.usuarios.length > 0; $('[data-empty]').textContent = M.noUsers;
    $('[data-page-info]').textContent = `Página ${d.pagina} de ${d.paginas} · ${d.total} usuario(s)`;
    $('[data-action="prev"]').disabled = d.pagina <= 1; $('[data-action="next"]').disabled = d.pagina >= d.paginas;
  }
  function abrir(id) {
    actual = filas.get(id); if (!actual) return;
    forms.forEach(f => { ui.clearErrors(f); f.reset(); }); ui.hideAlert(lista); panel.hidden = false;
    document.querySelectorAll('.row-btn').forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.id) === id)));
    $('[data-d="nombre"]').textContent = nombreDe(actual);
    $('[data-d="facts"]').innerHTML = `<dt>Correo</dt><dd>${esc(actual.correo || '—')}</dd><dt>Estado</dt><dd>${badge(actual.estado)}</dd><dt>Registro</dt><dd>${esc(actual.registro)}</dd>` +
      `<dt>Último acceso</dt><dd>${esc(actual.ultimo_acceso || 'Nunca')}</dd><dt>Reportes</dt><dd>${actual.reportes}</dd><dt>Alertas enviadas</dt><dd>${actual.alertas}</dd>`;
    fAlerta.hidden = fBan.hidden = actual.estado_id !== 1;                    // alertar y banear: solo cuentas Activa
    fDel.hidden = ![1, 3, 4].includes(actual.estado_id);                      // eliminar: Activa, Suspendida o Baneada
  }
  const mensaje = (c, soloActiva) => ({ ONLY_ACTIVE: soloActiva, NOT_INACTIVE: M.notInactive, REASON_INVALID: M.reasonRequired, COMMENT_MAX: M.stateCommentMax,
    MESSAGE_RANGE: M.alertRange, WRONG_PASSWORD: M.wrongPassword, PASSWORD_REQUIRED: M.required, ALREADY_DELETED: M.userAlreadyDeleted,
    INVALID_STATE: M.invalidAccountState, NOT_FOUND: M.userNotFound, NETWORK: M.network }[c] || M.unknown);
  async function resultado(form, r, okMsg, soloActiva) {
    if (r.ok) { cerrar(); await cargarLista(); return ui.showAlert(lista, 'success', okMsg); }
    const c = r.data.code;
    if (['ONLY_ACTIVE', 'ALREADY_DELETED', 'INVALID_STATE', 'NOT_FOUND'].includes(c)) { cerrar(); await cargarLista(); return ui.showAlert(lista, 'warning', mensaje(c, soloActiva)); }   // la cuenta cambió: se actualiza la lista
    ui.showAlert(form, 'error', mensaje(c, soloActiva));
  }
  const enviar = async (form, llamada, okMsg, soloActiva) => { limites.get(form).register(); busy(form, true); const r = await llamada(); busy(form, false); return resultado(form, r, okMsg, soloActiva); };

  fAlerta.addEventListener('submit', (e) => {                                  // RF_30
    e.preventDefault(); ui.clearErrors(fAlerta);
    const texto = fAlerta.elements.mensaje.value.trim();
    if (texto.length < RULES.ALERT_MIN || texto.length > RULES.ALERT_MAX) return ui.setFieldError(fAlerta, 'mensaje', M.alertRange);   // flujo alterno 1
    enviar(fAlerta, () => api.usuAlertar(actual.id, { mensaje: texto }), M.alertSent, M.onlyActiveAlert);
  });
  fBan.addEventListener('submit', (e) => {                                     // RF_28
    e.preventDefault(); ui.clearErrors(fBan);
    const motivo = fBan.elements.motivo.value, comentario = fBan.elements.comentario.value.trim();
    if (!motivo) return ui.setFieldError(fBan, 'motivo', M.reasonRequired);
    if (comentario.length > RULES.BAN_COMMENT_MAX) return ui.setFieldError(fBan, 'comentario', M.stateCommentMax);
    if (!confirm(M.confirmBan)) return;                                        // confirmación cancelada: sin cambios
    enviar(fBan, () => api.usuBanear(actual.id, { motivo, comentario }), M.userBanned, M.onlyActiveBan);
  });
  fDel.addEventListener('submit', async (e) => {                               // RF_29
    e.preventDefault(); ui.clearErrors(fDel);
    const contrasena = fDel.elements.contrasena.value;
    if (!contrasena) return ui.setFieldError(fDel, 'contrasena', M.required);
    if (!confirm(M.confirmUserDelete)) return;
    await enviar(fDel, () => api.usuEliminar(actual.id, { contrasena }), M.userDeleted);
    fDel.elements.contrasena.value = '';                                       // la contraseña nunca se queda en pantalla
  });
  selEstado.addEventListener('change', () => { pagina = 1; cerrar(); cargarLista(); });
  inBuscar.addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(() => { pagina = 1; cerrar(); cargarLista(); }, 350); });   // espera a que termine de escribir
  document.addEventListener('click', (e) => {
    const fila = e.target.closest('.row-btn'), acc = e.target.closest('[data-action]');
    if (fila) abrir(Number(fila.dataset.id));
    else if (acc && acc.dataset.action === 'prev') { pagina--; cargarLista(); }
    else if (acc && acc.dataset.action === 'next') { pagina++; cargarLista(); }
  });
  cargarLista();
});
