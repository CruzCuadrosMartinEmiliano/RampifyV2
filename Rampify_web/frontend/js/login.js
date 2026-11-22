/* ===== login.js — vistas: login → recovery-email → recovery-code → recovery-password → recovery-success ===== */
(() => {
  const { CONFIG, MESSAGES: M, validators: V, ui, api } = Rampify;
  const state = { correo: '', codigo: '' };           // se conservan entre pasos de recuperación
  const $ = (s, r = document) => r.querySelector(s);
  const views = [...document.querySelectorAll('[data-view]')];
  const limiters = new Map(views.map(v => [v, Rampify.createRateLimiter(v)]));

  function showView(name) {
    views.forEach(v => { v.hidden = v.dataset.view !== name; });
    const active = $(`[data-view="${name}"]`); ui.clearErrors(active);
    const first = active.querySelector('input'); first && first.focus();
  }
  const val = (form, name) => form.elements[name].value.trim();
  const fail = (form, name, msg) => { ui.setFieldError(form, name, msg); return !!msg; };
  const busy = (form, on) => { if (!on && form.dataset.locked) return; form.querySelectorAll('[data-submit]').forEach(b => b.disabled = on); };
  const getMsg = (r) => {
    const d = r.data || {};
    switch (d.code) {
      case 'INVALID_CREDENTIALS': return M.invalidCredentials;
      case 'CODE_INVALID':        return M.codeInvalid;
      case 'CODE_BLOCKED':        return M.codeBlocked;
      case 'PASSWORD_RULES':      return M.passwordRules;
      case 'NETWORK':             return M.network;
      default:                    return M.unknown;
    }
  };

  /* ---- RF_01 Iniciar sesión ---- */
  const formLogin = $('[data-view="login"]');
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(formLogin);
    const correo = val(formLogin, 'correo'), contrasena = formLogin.elements.contrasena.value;
    const bad = [fail(formLogin, 'correo', V.correo(correo)), fail(formLogin, 'contrasena', V.contrasenaLogin(contrasena))];
    if (bad.some(Boolean)) return;
    limiters.get(formLogin).register(); busy(formLogin, true);
    const r = await api.login({ correo, contrasena });
    if (r.ok) return void (location.href = CONFIG.ROLE_ROUTES[r.data.rol] || CONFIG.ROLE_ROUTES['Empleado de la asociación']);
    busy(formLogin, false);
    if (r.data.code === 'ROLE_NOT_ALLOWED')    showView('app-only');
    else if (r.data.code === 'ACCOUNT_LOCKED')      Rampify.lockForm(formLogin, r.data.retry_after_seconds, s => M.accountLocked(ui.formatTime(s)));
    else if (r.data.code === 'ACCOUNT_STATE')  ui.showAlert(formLogin, 'warning', M.accountState(r.data.estado_cuenta));
    else                                       ui.showAlert(formLogin, 'error', getMsg(r));
  });

  /* ---- RF_02 Paso 1: correo ---- */
  const formEmail = $('[data-view="recovery-email"]');
  formEmail.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(formEmail);
    const correo = val(formEmail, 'correo');
    if (fail(formEmail, 'correo', V.correo(correo))) return;
    limiters.get(formEmail).register(); busy(formEmail, true);
    const r = await api.recoveryRequest({ correo }); busy(formEmail, false);
    if (!r.ok && r.data.code === 'NETWORK') return ui.showAlert(formEmail, 'error', M.network);
    state.correo = correo;                              // misma respuesta exista o no el correo
    showView('recovery-code'); ui.showAlert($('[data-view="recovery-code"]'), 'success', M.recoveryRequested);
  });

  /* ---- RF_02 Paso 2: código (validar y reenviar) ---- */
  const formCode = $('[data-view="recovery-code"]');
  formCode.elements.codigo.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
  formCode.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(formCode);
    const codigo = val(formCode, 'codigo');
    if (fail(formCode, 'codigo', V.codigo(codigo))) return;
    limiters.get(formCode).register(); busy(formCode, true);
    const r = await api.recoveryVerify({ correo: state.correo, codigo }); busy(formCode, false);
    if (!r.ok) {
      ui.showAlert(formCode, 'error', getMsg(r));
      if (r.data.code === 'CODE_BLOCKED') formCode.querySelector('[data-action="verify"]').disabled = true; // solo permite reenviar
      return;
    }
    state.codigo = codigo; showView('recovery-password');
  });
  $('[data-action="resend-code"]', formCode).addEventListener('click', async () => {
    ui.clearErrors(formCode); limiters.get(formCode).register();
    const r = await api.recoveryRequest({ correo: state.correo });
    if (r.data && r.data.code === 'RESEND_LIMIT') return ui.showAlert(formCode, 'error', M.resendLimit(Math.ceil(r.data.retry_after_seconds / 60)));
    if (!r.ok) return ui.showAlert(formCode, 'error', getMsg(r));
    formCode.querySelector('[data-action="verify"]').disabled = false; formCode.reset();
    ui.showAlert(formCode, 'success', M.codeResent);
  });

  /* ---- RF_02 Paso 3: nueva contraseña ---- */
  const formPass = $('[data-view="recovery-password"]');
  formPass.addEventListener('submit', async (e) => {
    e.preventDefault(); ui.clearErrors(formPass);
    const nueva = formPass.elements.nueva_contrasena.value, conf = formPass.elements.confirmar_contrasena.value;
    const bad = [fail(formPass, 'nueva_contrasena', V.contrasenaNueva(nueva)),
                 fail(formPass, 'confirmar_contrasena', nueva !== conf ? M.passwordMismatch : '')];
    if (bad.some(Boolean)) return;
    limiters.get(formPass).register(); busy(formPass, true);
    const r = await api.recoveryReset({ correo: state.correo, codigo: state.codigo, nueva_contrasena: nueva }); busy(formPass, false);
    if (!r.ok) return ui.showAlert(formPass, 'error', getMsg(r));
    state.codigo = ''; formPass.reset(); showView('recovery-success');
  });

  /* ---- Navegación y mostrar/ocultar contraseña ---- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]'); if (!el) return;
    if (el.dataset.action === 'go') showView(el.dataset.target);
    if (el.dataset.action === 'toggle-password') {
      const input = el.closest('.field__control').querySelector('input'), show = input.type === 'password';
      input.type = show ? 'text' : 'password'; el.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    }
  });
  const links = CONFIG.APP_LINKS;
  document.querySelectorAll('[data-store]').forEach(a => {
    const url = links[a.dataset.store];
    if (url) a.href = url; else { a.setAttribute('aria-disabled', 'true'); a.querySelector('small').textContent = M.comingSoon; }
  });
  showView('login');
  if (new URLSearchParams(location.search).has('expirada')) ui.showAlert(formLogin, 'warning', M.sessionExpired);   // RNF-SEG-04
})();