const jwt = require('jsonwebtoken');
const db = require('../DB/database');

const DURACION_MIN = 30;

function emitirToken(usuario) {
  return jwt.sign(
    { id: usuario.id_usuario, rol: usuario.rol, canal: 'mobile' },
    process.env.JWT_SECRET,
    { expiresIn: DURACION_MIN * 60 }
  );
}

function requireMobileAuth(...roles) {
  return async (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    let datos;
    try {
      datos = jwt.verify(token, process.env.JWT_SECRET);
      if (datos.canal !== 'mobile') throw new Error('invalid_channel');
    } catch {
      return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED' });
    }
    try {
      const [filas] = await db.query(
        `SELECT u.id_usuario, u.nombre, u.correo, u.id_estado_cuenta, r.nombre AS rol
           FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
          WHERE u.id_usuario = ?`,
        [datos.id]
      );
      const usuario = filas[0];
      if (!usuario || usuario.id_estado_cuenta !== 1) {
        return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED' });
      }
      if (roles.length && !roles.includes(usuario.rol)) {
        return res.status(403).json({ ok: false, code: 'FORBIDDEN' });
      }
      req.usuario = { id: usuario.id_usuario, rol: usuario.rol };
      req.usuarioDetalle = usuario;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { emitirToken, requireMobileAuth };
