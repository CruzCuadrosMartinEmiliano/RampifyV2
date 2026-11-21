/* ===== perfil.js — RF_15 eliminar cuenta · RF_16 cancelar eliminación · RF_17 actualizar correo · RF_18 actualizar contraseña (Empleado y Administrador) ===== */
Rampify.ready.then((user) => {
  if (!user) return;
  const { api, MESSAGES: M, validators: V, ui, esc } = Rampify, $ = (s) => document.querySelector(s);
  const datos = $('[data-form="datos"]'), fCorreo = $('[data-form="correo"]'), fCodigo = $('[data-form="codigo"]'), fPass = $('[data-form="contrasena"]');
  const fDel = $('[data-form="eliminar"]'), fCancel = $('[data-form="cancelar"]');
  const forms = [fCorreo, fCodigo, fPass, fDel, fCancel], limites = new Map(forms.map(f => [f, Rampify.createRateLimiter(f)]));
  const btnConfirmar = fCodigo.querySelector('[data-action="confirmar"]');
  let fechaEliminacion = null, bloqueado = false;                                 // bloqueado: 5 intentos incorrectos (RF_17 E4)
  const busy = (f, on) => f.querySelectorAll('[data-submit]').forEach(b => { if (!on || !f.dataset.locked) b.disabled = on; });
  const sincronizarCodigo = () => { btnConfirmar.disabled = bloqueado; fCodigo.elements.codigo.disabled = bloqueado; };   // bloqueado: solo permite reenviar
  const minutos = (r) => Math.ceil((r.data.retry_after_seconds || 60) / 60);
  const enviar = async (form, llamada) => { limites.get(form).register(); busy(form, true); const r = await llamada(); busy(form, false); return r; };

  async function cargar() {
    const r = await api.perfil();
    if (!r.ok) return ui.showAlert(datos, 'error', M.profileError);
    const d = r.data; ui.hideAlert(datos);
    $('[data-d="facts"]').innerHTML = `<dt>Nombre</dt><dd>${esc(d.nombre)}</dd><dt>Correo</dt><dd>${esc(d.correo)}</dd><dt>Rol</dt><dd>${esc(d.rol)}</dd><dt>Registro</dt><dd>${esc(d.registro)}</dd>`;
    pintarEliminacion(d.eliminacion);
  }
  function pintarEliminacion(fecha) {                                            // RF_15 flujo alterno 3: con eliminación programada se ofrece cancelar (RF_16)
    fechaEliminacion = fecha || null; ui.hideAlert(fDel); ui.hideAlert(fCancel);
    fDel.hidden = !!fechaEliminacion; fCancel.hidden = !fechaEliminacion;
    if (fechaEliminacion) $('[data-d="fecha"]').textContent = fechaEliminacion;
  }
  function pasoCorreo() { fCodigo.hidden = true; fCodigo.reset(); ui.clearErrors(fCodigo); bloqueado = false; sincronizarCodigo(); fCorreo.hidden = false; }

  /* ---------- RF_17 Actualizar correo ---------- */
  fCorreo.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fCorreo);
    const correo = fCorreo.elements.correo.value.trim(), contrasena = fCorreo.elements.contrasena.value;
    const eC = V.correo(correo), eP = contrasena ? '' : M.required;
    ui.setFieldError(fCorreo, 'correo', eC); ui.setFieldError(fCorreo, 'contrasena', eP);
    if (eC || eP) return;
    const r = await enviar(fCorreo, () => api.perfilCorreoSolicitar({ correo, contrasena }));
    fCorreo.elements.contrasena.value = '';                                      // la contraseña nunca se queda en pantalla
    if (r.ok) {
      fCorreo.hidden = true; fCodigo.hidden = false; bloqueado = false; sincronizarCodigo();
      $('[data-d="destino"]').textContent = correo; ui.showAlert(fCodigo, 'success', M.codeSent); fCodigo.elements.codigo.focus(); return;
    }
    const c = r.data.code;
    if (c === 'WRONG_PASSWORD') ui.setFieldError(fCorreo, 'contrasena', M.wrongPassword);                        // E2
    else if (c === 'EMAIL_TAKEN') ui.setFieldError(fCorreo, 'correo', M.emailTaken);                             // E1
    else if (c === 'INVALID_EMAIL') ui.setFieldError(fCorreo, 'correo', M.emailInvalid);
    else if (c === 'RESEND_LIMIT') ui.showAlert(fCorreo, 'error', M.resendLimit(minutos(r)));                    // E6
    else ui.showAlert(fCorreo, 'error', c === 'MAIL_FAILED' ? M.codeMailFailed : c === 'NETWORK' ? M.network : M.unknown);
  });
  fCodigo.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fCodigo);
    const codigo = fCodigo.elements.codigo.value.trim(), err = V.codigo(codigo);
    if (err) return ui.setFieldError(fCodigo, 'codigo', err);
    const r = await enviar(fCodigo, () => api.perfilCorreoConfirmar({ codigo })); sincronizarCodigo();
    if (r.ok) { pasoCorreo(); fCorreo.reset(); ui.showAlert(fCorreo, 'success', M.emailUpdated); return cargar(); }          // CA1
    const c = r.data.code;
    if (c === 'CODE_INVALID') { fCodigo.elements.codigo.value = ''; return ui.setFieldError(fCodigo, 'codigo', M.codeInvalid); }       // E3
    if (c === 'CODE_BLOCKED') { bloqueado = true; sincronizarCodigo(); return ui.showAlert(fCodigo, 'error', M.codeBlocked); }         // E4
    if (c === 'EMAIL_TAKEN' || c === 'NO_PENDING') { pasoCorreo(); return ui.showAlert(fCorreo, 'error', c === 'EMAIL_TAKEN' ? M.emailTaken : M.noPendingChange); }
    ui.showAlert(fCodigo, 'error', c === 'NETWORK' ? M.network : M.unknown);
  });
  fCodigo.querySelector('[data-action="reenviar"]').addEventListener('click', async () => {      // E5 / E6
    ui.clearErrors(fCodigo);
    const r = await enviar(fCodigo, () => api.perfilCorreoReenviar()); sincronizarCodigo();
    if (r.ok) { bloqueado = false; fCodigo.elements.codigo.value = ''; sincronizarCodigo(); return ui.showAlert(fCodigo, 'success', M.codeResent); }
    const c = r.data.code;
    if (c === 'RESEND_LIMIT') return ui.showAlert(fCodigo, 'error', M.resendLimit(minutos(r)));
    if (c === 'NO_PENDING') { pasoCorreo(); return ui.showAlert(fCorreo, 'error', M.noPendingChange); }
    ui.showAlert(fCodigo, 'error', c === 'MAIL_FAILED' ? M.codeMailFailed : c === 'NETWORK' ? M.network : M.unknown);
  });
  fCodigo.querySelector('[data-action="volver"]').addEventListener('click', () => { pasoCorreo(); ui.clearErrors(fCorreo); });

  /* ---------- RF_18 Actualizar contraseña ---------- */
  fPass.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fPass);
    const { actual, nueva, confirmacion } = Object.fromEntries(['actual', 'nueva', 'confirmacion'].map(n => [n, fPass.elements[n].value]));
    const eA = actual ? '' : M.required, eN = V.contrasenaNueva(nueva), eC = !eN && nueva !== confirmacion ? M.passwordMismatch : (confirmacion ? '' : M.required);
    ui.setFieldError(fPass, 'actual', eA); ui.setFieldError(fPass, 'nueva', eN); ui.setFieldError(fPass, 'confirmacion', eC);   // E4 / E3
    if (eA || eN || eC) return;
    const r = await enviar(fPass, () => api.perfilContrasena({ actual, nueva, confirmacion }));
    if (r.ok) { fPass.reset(); return ui.showAlert(fPass, 'success', M.passwordUpdated); }
    const c = r.data.code;
    if (c === 'WRONG_PASSWORD') ui.setFieldError(fPass, 'actual', M.currentPasswordWrong);                       // E1
    else if (c === 'SAME_PASSWORD') ui.setFieldError(fPass, 'nueva', M.samePassword);                            // E2
    else if (c === 'PASSWORD_RULES') ui.setFieldError(fPass, 'nueva', M.passwordRules);
    else if (c === 'PASSWORD_MISMATCH') ui.setFieldError(fPass, 'confirmacion', M.passwordMismatch);
    else ui.showAlert(fPass, 'error', c === 'NETWORK' ? M.network : M.unknown);
  });

  /* ---------- RF_15 Eliminar cuenta ---------- */
  fDel.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fDel);
    const contrasena = fDel.elements.contrasena.value;
    if (!contrasena) return ui.setFieldError(fDel, 'contrasena', M.required);
    if (!confirm(M.confirmAccountDelete)) return;                                // flujo alterno 2: confirmación cancelada, sin cambios
    const r = await enviar(fDel, () => api.perfilEliminar({ contrasena }));
    fDel.elements.contrasena.value = '';
    if (r.ok) { pintarEliminacion(r.data.fecha); return ui.showAlert(fCancel, 'success', M.deleteScheduled(r.data.fecha)); }   // CA1
    const c = r.data.code;
    if (c === 'WRONG_PASSWORD') return ui.setFieldError(fDel, 'contrasena', M.wrongPassword);                    // E1
    if (c === 'ALREADY_SCHEDULED') { pintarEliminacion(r.data.fecha); return ui.showAlert(fCancel, 'warning', M.alreadyScheduled(r.data.fecha)); }   // E3
    ui.showAlert(fDel, 'error', c === 'INVALID_STATE' ? M.invalidAccountState : c === 'NETWORK' ? M.network : M.unknown);
  });

  /* ---------- RF_16 Cancelar eliminación ---------- */
  fCancel.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(fCancel);
    if (!confirm(M.confirmCancelDelete(fechaEliminacion))) return;               // flujo alterno 1: la eliminación sigue programada
    const r = await enviar(fCancel, () => api.perfilEliminarCancelar());
    if (r.ok) { pintarEliminacion(null); return ui.showAlert(fDel, 'success', M.deleteCanceled); }
    if (r.data.code === 'NOT_SCHEDULED') { pintarEliminacion(null); return ui.showAlert(fDel, 'warning', M.notScheduled); }
    ui.showAlert(fCancel, 'error', r.data.code === 'NETWORK' ? M.network : M.unknown);
  });

  cargar();
});