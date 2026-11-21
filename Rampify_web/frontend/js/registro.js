/* ===== registro.js — registro-empleado.html (RF_04) y registro-admin.html (RF_05) ===== */
(() => {
  const { MESSAGES: M, validators: V, ui, api } = Rampify;
  const form = document.querySelector('[data-form]'), type = form.dataset.form;       // 'empleado' | 'admin'
  const limiter = Rampify.createRateLimiter(form), done = document.querySelector('[data-done]');
  const token = new URLSearchParams(location.search).get('token');
  const val = (n) => form.elements[n].value.trim();
  const fail = (n, msg) => { ui.setFieldError(form, n, msg); return !!msg; };

  async function init() {                          // RF_05: validar invitación antes de mostrar el formulario
    if (type !== 'admin') return;
    form.hidden = true;
    const r = token ? await api.adminInviteCheck({ token }) : { ok: false };
    if (!r.ok) { done.querySelector('[data-done-text]').textContent = M.inviteInvalid; done.querySelector('[data-done-link]').hidden = true; return void (done.hidden = false); }
    form.elements.correo.value = r.data.correo; form.hidden = false;      // correo de la invitación, no editable
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(form);
    const nombre = val('nombre'), correo = val('correo'), pass = form.elements.contrasena.value, aviso = form.elements.acepta_aviso.checked;
    const bad = [fail('nombre', V.nombre(nombre)), type === 'empleado' && fail('correo', V.correo(correo)),
      fail('contrasena', V.contrasenaNueva(pass)), fail('confirmar_contrasena', pass !== form.elements.confirmar_contrasena.value ? M.passwordMismatch : ''),
      fail('acepta_aviso', V.aviso(aviso))];
    if (bad.some(Boolean)) return;
    limiter.register(); const btn = form.querySelector('[data-submit]'); btn.disabled = true;
    const body = { nombre, contrasena: pass, acepta_aviso: aviso };
    const r = type === 'empleado' ? await api.registerEmployee({ ...body, correo }) : await api.registerAdmin({ ...body, token });
    if (!form.dataset.locked) btn.disabled = false;
    if (r.ok) { form.hidden = true; done.hidden = false; return; }
    const c = r.data.code;
    ui.showAlert(form, 'error', c === 'EMAIL_TAKEN' ? M.emailTaken : c === 'INVITE_INVALID' ? M.inviteInvalid : c === 'NETWORK' ? M.network : M.unknown);
  });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action="toggle-password"]'); if (!b) return;
    const i = b.closest('.field__control').querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password';
  });
  init();
})();