// Mismas reglas que frontend/js/validators.js (el servidor nunca confía solo en el navegador)
const correoValido = (v) => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const nombreValido = (v) => typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 64 && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(v.trim());
const contrasenaValida = (v) => typeof v === 'string' && v.length >= 8 && v.length <= 64 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v);
module.exports = { correoValido, nombreValido, contrasenaValida };