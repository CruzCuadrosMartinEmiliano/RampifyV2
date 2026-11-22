// /api/solicitudes — RF_12 Forma 1: atender solicitudes de eliminación (solo Administrador)
const express = require('express');
const db = require('../DB/database');
const { requireAuth } = require('../Services/sesion');
const { transaccion, eliminarReporte, ROL_ADMIN, CRITERIO_SOLICITUD_AUTOR } = require('../Services/eliminacion');
const router = express.Router(), PAGINA = 20;
router.use(requireAuth('Administrador del sistema'));

// ---------- GET /api/solicitudes (solo Pendientes, las más antiguas primero) ----------
router.get('/', async (req, res, next) => {
  try {
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM solicitud_eliminacion_reporte s JOIN reporte r ON r.id_reporte = s.id_reporte WHERE s.estado = 'Pendiente' AND r.eliminado = 0`);
    const [solicitudes] = await db.query(
      `SELECT s.id_solicitud AS id, s.id_reporte, r.folio, s.motivo, u.nombre AS autor, DATE_FORMAT(s.fecha_solicitud, '%Y-%m-%d %H:%i') AS fecha
         FROM solicitud_eliminacion_reporte s JOIN reporte r ON r.id_reporte = s.id_reporte JOIN usuario u ON u.id_usuario = s.id_usuario
        WHERE s.estado = 'Pendiente' AND r.eliminado = 0 ORDER BY s.fecha_solicitud, s.id_solicitud LIMIT ? OFFSET ?`, [PAGINA, (pagina - 1) * PAGINA]);
    res.json({ ok: true, total, pagina, paginas: Math.max(Math.ceil(total / PAGINA), 1), solicitudes });
  } catch (e) { next(e); }
});

// Bloquea la solicitud y comprueba que siga Pendiente
async function solicitudPendiente(conn, id) {
  const [f] = await conn.query('SELECT id_reporte, estado FROM solicitud_eliminacion_reporte WHERE id_solicitud = ? FOR UPDATE', [id]);
  if (!f[0]) return { error: ['NOT_FOUND', 404] };
  if (f[0].estado !== 'Pendiente') return { error: ['REQUEST_RESOLVED', 409] };
  return { solicitud: f[0] };
}

// ---------- POST /api/solicitudes/:id/aprobar ----------
router.post('/:id/aprobar', (req, res, next) => transaccion(res, next, async (conn) => {
  const r = await solicitudPendiente(conn, Number(req.params.id) || 0);
  if (r.error) return r.error;
  return eliminarReporte(conn, r.solicitud.id_reporte, CRITERIO_SOLICITUD_AUTOR, req.usuario.id, 'APROBAR_SOLICITUD_ELIMINACION');   // también deja la solicitud Aprobada
}));

// ---------- POST /api/solicitudes/:id/rechazar { motivo: 10-200 caracteres } ----------
router.post('/:id/rechazar', (req, res, next) => {
  const motivo = String((req.body || {}).motivo || '').trim();
  if (motivo.length < 10 || motivo.length > 200) return res.status(400).json({ ok: false, code: 'REASON_RANGE' });
  transaccion(res, next, async (conn) => {
    const id = Number(req.params.id) || 0, r = await solicitudPendiente(conn, id);
    if (r.error) return r.error;
    await conn.query(`UPDATE solicitud_eliminacion_reporte SET estado = 'Rechazada', motivo_rechazo = ?, id_admin = ?, fecha_resolucion = NOW() WHERE id_solicitud = ?`, [motivo, req.usuario.id, id]);
    await conn.query(`INSERT INTO bitacora (id_usuario, id_rol, accion, entidad, id_entidad, detalle) VALUES (?, ?, 'RECHAZAR_SOLICITUD_ELIMINACION', 'solicitud', ?, NULL)`, [req.usuario.id, ROL_ADMIN, id]);
    return null;
  });
});
module.exports = router;