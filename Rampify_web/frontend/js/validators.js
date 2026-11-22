/* ===== validators.js — devuelven '' si es válido o el mensaje de error ===== */
Rampify.validators = (() => {
  const { RULES } = Rampify.CONFIG, M = Rampify.MESSAGES;
  return {
    correo(v) {
      if (typeof v !== 'string' || !v.trim()) return M.required;
      const value = v.trim();
      return value.length <= RULES.EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? '' : M.emailInvalid;
    },
    contrasenaLogin(v) {
      if (!v) return M.required;
      return v.length < RULES.PASSWORD_MIN || v.length > RULES.PASSWORD_MAX ? M.passwordLength : '';
    },
    contrasenaNueva(v) {
      if (!v) return M.required;
      const ok = v.length >= RULES.PASSWORD_MIN && v.length <= RULES.PASSWORD_MAX && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v);
      return ok ? '' : M.passwordRules;
    },
    nombre(v) {
      if (typeof v !== 'string' || !v.trim()) return M.required;
      const value = v.trim();
      return value.length >= RULES.NAME_MIN && value.length <= RULES.NAME_MAX && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(value) ? '' : M.nameInvalid;
    },
    aviso(checked) { return checked ? '' : M.privacyRequired; },
    codigo(v) {
      if (!v) return M.required;
      return new RegExp(`^\\d{${RULES.CODE_LENGTH}}$`).test(v) ? '' : M.codeFormat;
    },
  };
})();