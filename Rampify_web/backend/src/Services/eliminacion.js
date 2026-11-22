// Lógica compartida de RF_12: eliminación lógica de reportes y transacciones
const db = require('../DB/database');
const ROL_ADMIN = 3, CRITERIO_SOLICITUD_AUTOR = 4;

/* Ejecuta fn(conn) en una transacción. fn devuelve null (éxito) o [code, httpStatus] (error → rollback) */
async function transaccion(res, next, fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);                          // null = éxito · [code, status] = error · { despues } = éxito + acción tras el commit
    if (Array.isArray(r)) { await conn.rollback(); return res.status(r[1]).json({ ok: false, code: r[0] }); }
    await conn.commit();
    const extra = {};
    if (r && r.despues) { try { await r.despues(); extra.correo_enviado = true; } catch (e) { console.error('Correo no enviado:', e.message); extra.correo_enviado = false; } }
    res.json({ ok: true, ...extra });
  } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
}

/* Marca el reporte como eliminado (lógica), cierra su solicitud Pendiente como Aprobada y deja bitácora */
async function eliminarReporte(conn, idReporte, idCriterio, idAdmin, accion) {
  const [f] = await conn.query('SELECT eliminado FROM reporte WHERE id_reporte = ? FOR UPDATE', [idReporte]);
  if (!f[0]) return ['NOT_FOUND', 404];
  if (f[0].eliminado) return ['REPORT_DELETED', 409];
  await conn.query('UPDATE reporte SET eliminado = 1, fecha_eliminacion = NOW(), id_criterio_eliminacion = ? WHERE id_reporte = ?', [idCriterio, idReporte]);
  await conn.query(`UPDATE solicitud_eliminacion_reporte SET estado = 'Aprobada', id_admin = ?, fecha_resolucion = NOW() WHERE id_reporte = ? AND estado = 'Pendiente'`, [idAdmin, idReporte]);
  await conn.query(`INSERT INTO bitacora (id_usuario, id_rol, accion, entidad, id_entidad, detalle) VALUES (?, ?, ?, 'reporte', ?, ?)`,
    [idAdmin, ROL_ADMIN, accion, idReporte, `Criterio de eliminación ${idCriterio}`]);
  return null;
}
module.exports = { transaccion, eliminarReporte, ROL_ADMIN, CRITERIO_SOLICITUD_AUTOR };