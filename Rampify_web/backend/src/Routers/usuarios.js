// /api/usuarios — RF_28 Banear · RF_29 Eliminar · RF_30 Alertar usuario (solo Administrador). Los usuarios son las cuentas del rol 1 (Usuario de la app).
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../DB/database');
const { requireAuth } = require('../Services/sesion');
const { transaccion, ROL_ADMIN } = require('../Services/eliminacion');
const router = express.Router(), PAGINA = 20, ROL_USUARIO = 1;
const ESTADO = { ACTIVA: 1, SUSPENDIDA: 3, BANEADA: 4, ELIMINADA: 5 };
const MOTIVOS_BAN = ['Inactividad de más de 365 días', 'Mal uso de la app'], MOTIVO_ELIMINAR = 'Infracción grave de los Términos y Condiciones';
const COMENTARIO_MAX = 300, ALERTA_MIN = 10, ALERTA_MAX = 300, DIAS_INACTIVIDAD = 365, DETALLE_MAX = 255;
const fail = (res, status, code) => res.status(status).json({ ok: false, code });
const pag = (q) => Math.max(parseInt(q.pagina) || 1, 1);
router.use(requireAuth('Administrador del sistema'));

const bitacora = (conn, idAdmin, accion, idUsuario, detalle) => conn.query(
  `INSERT INTO bitacora (id_usuario, id_rol, accion, entidad, id_entidad, detalle) VALUES (?, ?, ?, 'usuario', ?, ?)`,
  [idAdmin, ROL_ADMIN, accion, idUsuario, detalle ? String(detalle).slice(0, DETALLE_MAX) : null]);

// Bloquea la cuenta de un Usuario de la app (rol 1). "inactivo" = último inicio de sesión (o registro, si nunca entró) con más de 365 días
async function usuario(conn, id) {
  const [f] = await conn.query(
    `SELECT id_usuario, id_estado_cuenta AS estado, COALESCE(ultimo_acceso, fecha_registro) < DATE_SUB(NOW(), INTERVAL ? DAY) AS inactivo
       FROM usuario WHERE id_usuario = ? AND id_rol = ? FOR UPDATE`, [DIAS_INACTIVIDAD, id, ROL_USUARIO]);
  return f[0] || null;
}

// ---------- GET /api/usuarios?estado=1|3|4|5&q=&pagina= (lista para moderar) ----------
router.get('/', async (req, res, next) => {
  try {
    const p = pag(req.query), estado = Number(req.query.estado), q = String(req.query.q || '').trim().slice(0, 254);
    const donde = ['u.id_rol = ?'], par = [ROL_USUARIO];
    if (Object.values(ESTADO).includes(estado)) { donde.push('u.id_estado_cuenta = ?'); par.push(estado); }
    else donde.push('u.id_estado_cuenta IN (1, 3, 4, 5)');
    if (q) { const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`; donde.push('(u.nombre LIKE ? OR u.correo LIKE ?)'); par.push(like, like); }   // los comodines escritos por el admin se tratan como texto
    const where = donde.join(' AND ');
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM usuario u WHERE ${where}`, par);
    const [usuarios] = await db.query(
      `SELECT u.id_usuario AS id, u.nombre, u.correo, u.id_estado_cuenta AS estado_id, e.nombre AS estado,
              DATE_FORMAT(u.fecha_registro, '%Y-%m-%d') AS registro, DATE_FORMAT(u.ultimo_acceso, '%Y-%m-%d') AS ultimo_acceso,
              (SELECT COUNT(*) FROM reporte r WHERE r.id_usuario = u.id_usuario) AS reportes,
              (SELECT COUNT(*) FROM alerta_usuario a WHERE a.id_usuario = u.id_usuario) AS alertas
         FROM usuario u JOIN estado_cuenta e ON e.id_estado_cuenta = u.id_estado_cuenta WHERE ${where}
        ORDER BY u.fecha_registro DESC, u.id_usuario DESC LIMIT ? OFFSET ?`, [...par, PAGINA, (p - 1) * PAGINA]);
    res.json({ ok: true, total, pagina: p, paginas: Math.max(Math.ceil(total / PAGINA), 1), usuarios });
  } catch (e) { next(e); }
});

// ---------- RF_28: POST /api/usuarios/:id/banear { motivo, comentario? } ----------
router.post('/:id/banear', (req, res, next) => {
  const { motivo } = req.body || {}, comentario = String((req.body || {}).comentario || '').trim();
  if (!MOTIVOS_BAN.includes(motivo)) return fail(res, 400, 'REASON_INVALID');
  if (comentario.length > COMENTARIO_MAX) return fail(res, 400, 'COMMENT_MAX');
  transaccion(res, next, async (conn) => {
    const u = await usuario(conn, Number(req.params.id) || 0);
    if (!u) return ['NOT_FOUND', 404];
    if (u.estado !== ESTADO.ACTIVA) return ['ONLY_ACTIVE', 409];                                       // E1
    if (motivo === MOTIVOS_BAN[0] && !u.inactivo) return ['NOT_INACTIVE', 409];                        // flujo básico, sistema 1
    await conn.query('UPDATE usuario SET id_estado_cuenta = ? WHERE id_usuario = ?', [ESTADO.BANEADA, u.id_usuario]);   // requireAuth corta sus sesiones en la siguiente petición; los reportes no se tocan (CA2)
    await bitacora(conn, req.usuario.id, 'BANEAR_USUARIO', u.id_usuario, comentario ? `${motivo}: ${comentario}` : motivo);
    return null;
  });
});

// ---------- RF_29: POST /api/usuarios/:id/eliminar { contrasena (la del administrador) } ----------
router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const { contrasena } = req.body || {};
    if (typeof contrasena !== 'string' || !contrasena) return fail(res, 400, 'PASSWORD_REQUIRED');
    const [[yo]] = await db.query('SELECT contrasena_hash FROM usuario WHERE id_usuario = ?', [req.usuario.id]);
    if (!yo || !yo.contrasena_hash || !await bcrypt.compare(contrasena, yo.contrasena_hash)) return fail(res, 403, 'WRONG_PASSWORD');   // E1
    transaccion(res, next, async (conn) => {
      const u = await usuario(conn, Number(req.params.id) || 0);
      if (!u) return ['NOT_FOUND', 404];
      if (u.estado === ESTADO.ELIMINADA) return ['ALREADY_DELETED', 409];
      if (![ESTADO.ACTIVA, ESTADO.SUSPENDIDA, ESTADO.BANEADA].includes(u.estado)) return ['INVALID_STATE', 409];
      // CA1/CA2: se borran nombre, correo y contraseña; el id y sus reportes se conservan sin datos personales
      await conn.query('UPDATE usuario SET nombre = NULL, correo = NULL, contrasena_hash = NULL, id_estado_cuenta = ? WHERE id_usuario = ?', [ESTADO.ELIMINADA, u.id_usuario]);
      await conn.query('UPDATE sancion_cuenta SET activa = 0 WHERE id_usuario = ? AND activa = 1', [u.id_usuario]);
      await conn.query('DELETE FROM codigo_verificacion WHERE id_usuario = ?', [u.id_usuario]);        // guarda su correo como destino: también es dato personal
      await bitacora(conn, req.usuario.id, 'ELIMINAR_USUARIO', u.id_usuario, MOTIVO_ELIMINAR);         // CA4
      return null;
    });
  } catch (e) { next(e); }
});

// ---------- RF_30: POST /api/usuarios/:id/alertar { mensaje } ----------
// La alerta se guarda en alerta_usuario y no consulta las preferencias de notificación (RF_20): se entrega siempre (CA2)
router.post('/:id/alertar', (req, res, next) => {
  const mensaje = typeof (req.body || {}).mensaje === 'string' ? req.body.mensaje.trim() : '';
  if (mensaje.length < ALERTA_MIN || mensaje.length > ALERTA_MAX) return fail(res, 400, 'MESSAGE_RANGE');   // E1
  transaccion(res, next, async (conn) => {
    const u = await usuario(conn, Number(req.params.id) || 0);
    if (!u) return ['NOT_FOUND', 404];
    if (u.estado !== ESTADO.ACTIVA) return ['ONLY_ACTIVE', 409];                                       // E2
    const [ins] = await conn.query('INSERT INTO alerta_usuario (id_usuario, id_admin, mensaje) VALUES (?, ?, ?)', [u.id_usuario, req.usuario.id, mensaje]);   // fecha_envio: DEFAULT NOW() (CA1)
    await bitacora(conn, req.usuario.id, 'ALERTAR_USUARIO', u.id_usuario, `Alerta ${ins.insertId}`);
    return null;
  });
});
module.exports = router;
