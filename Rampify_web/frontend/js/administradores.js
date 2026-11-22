/* ===== administradores.js — RF_24 Invitar administrador (el registro con el enlace es RF_05) ===== */
Rampify.ready.then((user) => {
  if (!user) return;
  const { api, MESSAGES: M, validators: V, ui } = Rampify, form = document.querySelector('[data-form="invitar"]');
  const limiter = Rampify.createRateLimiter(form), btn = form.querySelector('[data-submit]');
  const fail = (n, msg) => { ui.setFieldError(form, n, msg); return !!msg; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(form);
    const correo = form.elements.correo.value.trim(), contrasena = form.elements.contrasena.value;
    const bad = [fail('correo', V.correo(correo)), fail('contrasena', contrasena ? '' : M.required)];
    if (bad.some(Boolean)) return;
    limiter.register(); btn.disabled = true;
    const r = await api.invitarAdmin({ correo, contrasena });
    if (!form.dataset.locked) btn.disabled = false;
    form.elements.contrasena.value = '';                                        // la contraseña nunca se queda en pantalla
    if (r.ok) {
      form.reset();
      return ui.showAlert(form, r.data.aviso_enviado === false ? 'warning' : 'success', r.data.aviso_enviado === false ? `${M.inviteSent} ${M.inviteNoticeFailed}` : M.inviteSent);
    }
    const c = r.data.code;
    if (c === 'WRONG_PASSWORD') fail('contrasena', M.wrongPassword);           // E2
    else if (c === 'EMAIL_TAKEN') fail('correo', M.emailTaken);                // E1
    else if (c === 'INVITE_EXISTS') fail('correo', M.inviteExists);            // E3
    else if (c === 'INVALID_EMAIL') fail('correo', M.emailInvalid);
    else ui.showAlert(form, 'error', c === 'MAIL_FAILED' ? M.inviteMailFailed : c === 'NETWORK' ? M.network : M.unknown);   // E4: se puede reintentar
  });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action="toggle-password"]'); if (!b) return;
    const i = b.closest('.field__control').querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password';
  });
});