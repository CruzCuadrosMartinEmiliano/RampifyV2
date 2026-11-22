/* ===== rate-limit.js — UI de errores/bloqueos y contador general (5 envíos/min → 30 s) ===== */
Rampify.ui = {
  setFieldError(form, name, msg) {
    const input = form.elements[name], out = form.querySelector(`[data-error-for="${name}"]`);
    if (out) out.textContent = msg || '';
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  },
  clearErrors(form) {
    form.querySelectorAll('[data-error-for]').forEach(e => this.setFieldError(form, e.dataset.errorFor, ''));
    this.hideAlert(form);
  },
  showAlert(form, type, msg) {
    const el = form.querySelector('[data-alert]');
    el.className = `alert alert--${type}`; el.textContent = msg; el.hidden = false;
  },
  hideAlert(form) { const el = form.querySelector('[data-alert]'); el.hidden = true; el.textContent = ''; },
  formatTime(s) { const m = Math.floor(s / 60), r = s % 60; return m ? `${m}:${String(r).padStart(2, '0')} min` : `${r} s`; },
};

/* Deshabilita los botones [data-submit] del formulario con cuenta regresiva; mensajeFn(segundosRestantes) → texto */
Rampify.lockForm = function (form, seconds, messageFn, onUnlock) {
  const btns = form.querySelectorAll('[data-submit]'); let left = seconds;
  const tick = () => {
    if (left <= 0) { clearInterval(t); delete form.dataset.locked; btns.forEach(b => b.disabled = false); Rampify.ui.hideAlert(form); onUnlock && onUnlock(); return; }
    Rampify.ui.showAlert(form, 'warning', messageFn(left)); left--;
  };
  form.dataset.locked = '1'; btns.forEach(b => b.disabled = true); tick();
  const t = setInterval(tick, 1000);
};

/* Un contador por formulario: llamar register() en cada envío */
Rampify.createRateLimiter = function (form) {
  const { MAX_REQUESTS, WINDOW_MS, LOCK_MS } = Rampify.CONFIG.RULES.RATE_LIMIT; let stamps = [];
  return {
    register() {
      const now = Date.now(); stamps = stamps.filter(t => now - t < WINDOW_MS); stamps.push(now);
      if (stamps.length >= MAX_REQUESTS) {
        stamps = [];
        setTimeout(() => Rampify.lockForm(form, LOCK_MS / 1000, Rampify.MESSAGES.rateLimited), 0);
      }
    },
  };
};