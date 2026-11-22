// Reglas compartidas de moderación de cuentas de la app (rol 1): RF_28 Banear · RF_29 Eliminar · RF_30 Alertar.
// Las usan /api/usuarios (directo) y /api/denuncias (RF_32), para que ambas apliquen exactamente las mismas reglas.
const ROL_USUARIO = 1, ROL_ADMIN = 3;
const ESTADO = { ACTIVA: 1, SUSPENDIDA: 3, BANEADA: 4, ELIMINADA: 5 };
const MOTIVO_ELIMINAR = 'Infracción grave de los Términos y Condiciones', DIAS_INACTIVIDAD = 365, DETALLE_MAX = 255;

const bitacora = (conn, idAdmin, accion, idUsuario, detalle) => conn.query(
  `INSERT INTO bitacora (id_usuario, id_rol, accion, entidad, id_entidad, detalle) VALUES (?, ?, ?, 'usuario', ?, ?)`,
  [idAdmin, ROL_ADMIN, accion, idUsuario, detalle ? String(detalle).slice(0, DETALLE_MAX) : null]);

// Bloquea la fila del Usuario de la app (rol 1). "inactivo" = último acceso (o registro, si nunca entró) con más de 365 días
async function usuario(conn, id) {
  const [f] = await conn.query(
    `SELECT id_usuario, id_estado_cuenta AS estado, COALESCE(ultimo_acceso, fecha_registro) < DATE_SUB(NOW(), INTERVAL ? DAY) AS inactivo
       FROM usuario WHERE id_usuario = ? AND id_rol = ? FOR UPDATE`, [DIAS_INACTIVIDAD, id, ROL_USUARIO]);
  return f[0] || null;
}

async function banear(conn, idAdmin, u, motivo, comentario) {                                   // RF_28
  await conn.query('UPDATE usuario SET id_estado_cuenta = ? WHERE id_usuario = ?', [ESTADO.BANEADA, u.id_usuario]);   // requireAuth corta sus sesiones en la siguiente petición; los reportes no se tocan
  await bitacora(conn, idAdmin, 'BANEAR_USUARIO', u.id_usuario, comentario ? `${motivo}: ${comentario}` : motivo);
}

async function eliminar(conn, idAdmin, u) {                                                      // RF_29: nombre, correo y contraseña se borran; el id y sus reportes se conservan
  await conn.query('UPDATE usuario SET nombre = NULL, correo = NULL, contrasena_hash = NULL, id_estado_cuenta = ? WHERE id_usuario = ?', [ESTADO.ELIMINADA, u.id_usuario]);
  await conn.query('UPDATE sancion_cuenta SET activa = 0 WHERE id_usuario = ? AND activa = 1', [u.id_usuario]);
  await conn.query('DELETE FROM codigo_verificacion WHERE id_usuario = ?', [u.id_usuario]);
  await bitacora(conn, idAdmin, 'ELIMINAR_USUARIO', u.id_usuario, MOTIVO_ELIMINAR);
}

async function alertar(conn, idAdmin, u, mensaje) {                                              // RF_30: se entrega siempre, sin consultar RF_20
  const [ins] = await conn.query('INSERT INTO alerta_usuario (id_usuario, id_admin, mensaje) VALUES (?, ?, ?)', [u.id_usuario, idAdmin, mensaje]);
  await bitacora(conn, idAdmin, 'ALERTAR_USUARIO', u.id_usuario, `Alerta ${ins.insertId}`);
}
module.exports = { ROL_USUARIO, ESTADO, MOTIVO_ELIMINAR, DIAS_INACTIVIDAD, bitacora, usuario, banear, eliminar, alertar };