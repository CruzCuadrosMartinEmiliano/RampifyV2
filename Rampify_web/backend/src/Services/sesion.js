const jwt = require('jsonwebtoken');
const db = require('../DB/database');
// RNF-SEG-04: la sesión expira tras 30 minutos sin actividad. Cada petición autenticada renueva el token (sesión deslizante).
const COOKIE = 'rampify_sesion', INACTIVIDAD_MIN = 30, DURACION_MS = INACTIVIDAD_MIN * 60 * 1000;

function abrirSesion(res, usuario) {
  const token = jwt.sign({ id: usuario.id_usuario, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: INACTIVIDAD_MIN * 60 });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: DURACION_MS });
}
function cerrarSesion(res) { res.clearCookie(COOKIE); }

// Middleware para proteger rutas: requireAuth() o requireAuth('Administrador del sistema', ...)
// Además de validar el token, confirma en la BD que la cuenta siga Activa: suspender o dar de baja corta la sesión al instante.
function requireAuth(...roles) {
  return async (req, res, next) => {
    let datos;
    try { datos = jwt.verify(req.cookies[COOKIE], process.env.JWT_SECRET); }
    catch { return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED' }); }
    try {
      const [f] = await db.query('SELECT id_estado_cuenta FROM usuario WHERE id_usuario = ?', [datos.id]);
      if (!f[0] || f[0].id_estado_cuenta !== 1) { cerrarSesion(res); return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED' }); }
      if (roles.length && !roles.includes(datos.rol)) return res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      abrirSesion(res, { id_usuario: datos.id, rol: datos.rol });          // renueva los 30 minutos
      req.usuario = datos; next();
    } catch (e) { next(e); }
  };
}
module.exports = { abrirSesion, cerrarSesion, requireAuth };