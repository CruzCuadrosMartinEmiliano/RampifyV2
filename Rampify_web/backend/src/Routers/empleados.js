// /api/empleados — RF_21 aprobar/rechazar peticiones · RF_22 suspender · RF_23 dar de baja (solo Administrador)
const express = require('express');
const db = require('../DB/database');
const { requireAuth } = require('../Services/sesion');
const { transaccion, ROL_ADMIN } = require('../Services/eliminacion');
const { enviarDecisionEmpleado } = require('../Services/correo');
const router = express.Router(), PAGINA = 20;
const ESTADO = { ACTIVA: 1, PENDIENTE: 2, SUSPENDIDA: 3, ELIMINADA: 5 }, MOTIVOS = ['Falta disciplinaria', 'Fin de contrato'];
const fail = (res, status, code) => res.status(status).json({ ok: false, code });
const pag = (q) => Math.max(parseInt(q.pagina) || 1, 1);
router.use(requireAuth('Administrador del sistema'));

const bitacora = (conn, idAdmin, accion, idEmp, detalle) => conn.query(
  `INSERT INTO bitacora (id_usuario, id_rol, accion, entidad, id_entidad, detalle) VALUES (?, ?, ?, 'usuario', ?, ?)`, [idAdmin, ROL_ADMIN, accion, idEmp, detalle || null]);
// Bloquea la cuenta de un empleado (rol 2) y la devuelve
async function empleado(conn, id) {
  const [f] = await conn.query('SELECT id_usuario, correo, id_estado_cuenta AS estado FROM usuario WHERE id_usuario = ? AND id_rol = 2 FOR UPDATE', [id]);
  return f[0] || null;
}

// ---------- RF_21: GET /api/empleados/solicitudes (peticiones Pendientes de autorización) ----------
router.get('/solicitudes', async (req, res, next) => {
  try {
    const p = pag(req.query);
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM usuario WHERE id_rol = 2 AND id_estado_cuenta = ?', [ESTADO.PENDIENTE]);
    const [solicitudes] = await db.query(`SELECT id_usuario AS id, nombre, correo, DATE_FORMAT(fecha_registro, '%Y-%m-%d %H:%i') AS fecha FROM usuario
        WHERE id_rol = 2 AND id_estado_cuenta = ? ORDER BY fecha_registro, id_usuario LIMIT ? OFFSET ?`, [ESTADO.PENDIENTE, PAGINA, (p - 1) * PAGINA]);
    res.json({ ok: true, total, pagina: p, paginas: Math.max(Math.ceil(total / PAGINA), 1), solicitudes });
  } catch (e) { next(e); }
});

router.post('/solicitudes/:id/aprobar', (req, res, next) => transaccion(res, next, async (conn) => {
  const e = await empleado(conn, Number(req.params.id) || 0);
  if (!e) return ['NOT_FOUND', 404];
  if (e.estado !== ESTADO.PENDIENTE) return ['REQUEST_RESOLVED', 409];
  await conn.query('UPDATE usuario SET id_estado_cuenta = ? WHERE id_usuario = ?', [ESTADO.ACTIVA, e.id_usuario]);
  await conn.query(`INSERT INTO decision_registro (id_usuario, id_admin, decision) VALUES (?, ?, 'Aprobar')`, [e.id_usuario, req.usuario.id]);
  await bitacora(conn, req.usuario.id, 'APROBAR_EMPLEADO', e.id_usuario);
  return { despues: () => enviarDecisionEmpleado(e.correo, true) };
}));

router.post('/solicitudes/:id/rechazar', (req, res, next) => {
  const motivo = String((req.body || {}).motivo || '').trim();
  if (motivo.length < 10 || motivo.length > 200) return fail(res, 400, 'REASON_RANGE');
  transaccion(res, next, async (conn) => {
    const e = await empleado(conn, Number(req.params.id) || 0);
    if (!e) return ['NOT_FOUND', 404];
    if (e.estado !== ESTADO.PENDIENTE) return ['REQUEST_RESOLVED', 409];
    await conn.query('UPDATE usuario SET id_estado_cuenta = ? WHERE id_usuario = ?', [ESTADO.ELIMINADA, e.id_usuario]);
    await conn.query(`INSERT INTO decision_registro (id_usuario, id_admin, decision, motivo) VALUES (?, ?, 'Rechazar', ?)`, [e.id_usuario, req.usuario.id, motivo]);
    await bitacora(conn, req.usuario.id, 'RECHAZAR_EMPLEADO', e.id_usuario);
    return { despues: () => enviarDecisionEmpleado(e.correo, false, motivo) };
  });
});

// ---------- GET /api/empleados?estado=1|3|5&pagina= (empleados ya resueltos) ----------
router.get('/', async (req, res, next) => {
  try {
    const p = pag(req.query), estado = Number(req.query.estado);
    const donde = [ESTADO.ACTIVA, ESTADO.SUSPENDIDA, ESTADO.ELIMINADA].includes(estado) ? 'u.id_estado_cuenta = ?' : 'u.id_estado_cuenta IN (1, 3, 5)';
    const par = donde.includes('= ?') ? [estado] : [];
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM usuario u WHERE u.id_rol = 2 AND ${donde}`, par);
    const [empleados] = await db.query(
      `SELECT u.id_usuario AS id, u.nombre, u.correo, u.id_estado_cuenta AS estado_id, e.nombre AS estado, DATE_FORMAT(u.fecha_registro, '%Y-%m-%d') AS registro,
              (SELECT DATE_FORMAT(s.fecha_fin, '%Y-%m-%d') FROM sancion_cuenta s WHERE s.id_usuario = u.id_usuario AND s.activa = 1 AND s.tipo = 'Suspensión' ORDER BY s.id_sancion DESC LIMIT 1) AS suspendido_hasta
         FROM usuario u JOIN estado_cuenta e ON e.id_estado_cuenta = u.id_estado_cuenta WHERE u.id_rol = 2 AND ${donde}
        ORDER BY u.nombre, u.id_usuario LIMIT ? OFFSET ?`, [...par, PAGINA, (p - 1) * PAGINA]);
    res.json({ ok: true, total, pagina: p, paginas: Math.max(Math.ceil(total / PAGINA), 1), empleados });
  } catch (e) { next(e); }
});

// ---------- RF_22: POST /api/empleados/:id/suspender { motivo, dias } ----------
router.post('/:id/suspender', (req, res, next) => {
  const { motivo } = req.body || {}, dias = Number((req.body || {}).dias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) return fail(res, 400, 'DURATION_RANGE');
  if (!MOTIVOS.includes(motivo)) return fail(res, 400, 'REASON_INVALID');
  transaccion(res, next, async (conn) => {
    const e = await empleado(conn, Number(req.params.id) || 0);
    if (!e) return ['NOT_FOUND', 404];
    if (e.estado !== ESTADO.ACTIVA) return ['ONLY_ACTIVE', 409];
    await conn.query('UPDATE usuario SET id_estado_cuenta = ? WHERE id_usuario = ?', [ESTADO.SUSPENDIDA, e.id_usuario]);   // requireAuth corta sus sesiones en la siguiente petición
    await conn.query(`INSERT INTO sancion_cuenta (id_usuario, id_admin, tipo, motivo, dias, fecha_fin) VALUES (?, ?, 'Suspensión', ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY))`,
      [e.id_usuario, req.usuario.id, motivo, dias, dias]);
    await bitacora(conn, req.usuario.id, 'SUSPENDER_EMPLEADO', e.id_usuario, `${motivo}, ${dias} día(s)`);
    return null;
  });
});

// ---------- RF_23: POST /api/empleados/:id/baja ----------
router.post('/:id/baja', (req, res, next) => transaccion(res, next, async (conn) => {
  const e = await empleado(conn, Number(req.params.id) || 0);
  if (!e) return ['NOT_FOUND', 404];
  if (e.estado === ESTADO.ELIMINADA) return ['ALREADY_DELETED', 409];
  if (![ESTADO.ACTIVA, ESTADO.SUSPENDIDA].includes(e.estado)) return ['INVALID_STATE', 409];
  await conn.query('UPDATE usuario SET id_estado_cuenta = ? WHERE id_usuario = ?', [ESTADO.ELIMINADA, e.id_usuario]);          // eliminación lógica: sus acciones se conservan
  await conn.query('UPDATE sancion_cuenta SET activa = 0 WHERE id_usuario = ? AND activa = 1', [e.id_usuario]);
  await bitacora(conn, req.usuario.id, 'BAJA_EMPLEADO', e.id_usuario);
  return null;
}));
module.exports = router;