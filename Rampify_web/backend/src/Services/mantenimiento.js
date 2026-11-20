// RF_22 CA2: a las 00:00 (America/Mexico_City) de la fecha de término, la cuenta suspendida vuelve a Activa
const db = require('../DB/database');
async function reactivarSuspensiones() {
  const [r] = await db.query(`UPDATE usuario u JOIN sancion_cuenta s ON s.id_usuario = u.id_usuario
      SET u.id_estado_cuenta = 1 WHERE s.activa = 1 AND s.tipo = 'Suspensión' AND s.fecha_fin <= NOW() AND u.id_estado_cuenta = 3`);
  await db.query(`UPDATE sancion_cuenta SET activa = 0 WHERE activa = 1 AND tipo = 'Suspensión' AND fecha_fin <= NOW()`);
  if (r.affectedRows) console.log(`Cuentas reactivadas tras suspensión: ${r.affectedRows}`);
}
// RF_15 CA2: al llegar la fecha de ejecución, se borran nombre, correo y contraseña y la cuenta pasa a Eliminada (los reportes se conservan sin datos personales)
const ESTADO_ELIMINADA = 5;
async function eliminarCuentasVencidas() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [f] = await conn.query(`SELECT id_usuario FROM usuario WHERE fecha_eliminacion_programada IS NOT NULL AND fecha_eliminacion_programada <= NOW()
                                   AND id_estado_cuenta IN (1, 3, 4) FOR UPDATE`);
    if (f.length) {
      const ids = f.map((x) => x.id_usuario);
      await conn.query('UPDATE usuario SET nombre = NULL, correo = NULL, contrasena_hash = NULL, id_estado_cuenta = ? WHERE id_usuario IN (?)', [ESTADO_ELIMINADA, ids]);
      await conn.query('UPDATE sancion_cuenta SET activa = 0 WHERE id_usuario IN (?) AND activa = 1', [ids]);
      await conn.query('DELETE FROM codigo_verificacion WHERE id_usuario IN (?)', [ids]);      // guarda su correo como destino: también es dato personal
      console.log(`Cuentas eliminadas al vencer su periodo de gracia: ${ids.length}`);
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}
function iniciar() {                        // al arrancar y cada minuto
  const correr = () => { reactivarSuspensiones().catch((e) => console.error('Mantenimiento:', e.message)); eliminarCuentasVencidas().catch((e) => console.error('Mantenimiento:', e.message)); };
  correr(); setInterval(correr, 60 * 1000);
}
module.exports = { iniciar, reactivarSuspensiones, eliminarCuentasVencidas };