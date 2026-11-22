const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../DB/database');
const { correoValido, nombreValido, contrasenaValida } = require('../Services/validar');
const { emitirToken, requireMobileAuth } = require('../Services/mobileAuth');

const router = express.Router();
const ROL_USUARIO = 'Usuario de la app';
const ESTADO = { PENDIENTE: 1, EN_PROCESO: 2, RECHAZADO: 4 };
const FOLIO = /^RMP-[A-Z0-9]{8}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_INTENTOS_LOGIN = 5;
const fail = (res, status, code, extra = {}) => res.status(status).json({ ok: false, code, ...extra });
const userAuth = requireMobileAuth(ROL_USUARIO);

function numeroEnRango(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function validarImagen(imagen, tipo) {
  if (imagen === undefined && tipo === undefined) return 'IMAGE_REQUIRED';
  if (typeof imagen !== 'string' || !['image/jpeg', 'image/png'].includes(tipo)) return 'IMAGE_INVALID';
  const base64 = imagen.replace(/^data:image\/(?:jpeg|png);base64,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 === 1) return 'IMAGE_INVALID';
  if (Buffer.byteLength(base64, 'base64') > 5 * 1024 * 1024) return 'IMAGE_TOO_LARGE';
  return null;
}

function nuevoFolio() {
  return `RMP-${crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'A').slice(0, 8).toUpperCase()}`;
}

async function folioDisponible(conn) {
  for (let i = 0; i < 5; i += 1) {
    const folio = nuevoFolio();
    const [filas] = await conn.query('SELECT 1 FROM reporte WHERE folio = ? LIMIT 1', [folio]);
    if (!filas[0]) return folio;
  }
  throw Object.assign(new Error('folio_generation_failed'), { code: 'FOLIO_GENERATION_FAILED' });
}

function filtrosFecha(query, params, owner) {
  const desde = query.desde ? String(query.desde) : '';
  const hasta = query.hasta ? String(query.hasta) : '';
  if ((desde && !FECHA.test(desde)) || (hasta && !FECHA.test(hasta))) return ['DATE_INVALID'];
  if (desde && hasta && hasta < desde) return ['DATE_RANGE'];
  const where = [`r.id_usuario = ?`, 'r.eliminado = 0'];
  params.push(owner);
  if (desde) { where.push('r.fecha_creacion >= ?'); params.push(desde); }
  if (hasta) { where.push('r.fecha_creacion < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(hasta); }
  else where.push('r.fecha_creacion < DATE_ADD(CURDATE(), INTERVAL 1 DAY)');
  return [null, where];
}

// RF_03
router.post('/auth/registro', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!nombreValido(b.nombre) || !correoValido(b.correo) || !contrasenaValida(b.contrasena)) {
      return fail(res, 400, 'VALIDATION');
    }
    const [ya] = await db.query('SELECT 1 FROM usuario WHERE correo = ?', [b.correo.trim().toLowerCase()]);
    if (ya[0]) return fail(res, 409, 'EMAIL_TAKEN');
    const [insertado] = await db.query(
      `INSERT INTO usuario (id_rol, id_estado_cuenta, nombre, correo, contrasena_hash, fecha_aceptacion_aviso)
       SELECT r.id_rol, 1, ?, ?, ?, NOW() FROM rol r WHERE r.nombre = ?`,
      [b.nombre.trim(), b.correo.trim().toLowerCase(), await bcrypt.hash(b.contrasena, 10), ROL_USUARIO]
    );
    if (!insertado.affectedRows) return fail(res, 500, 'ROLE_NOT_CONFIGURED');
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

// RF_01 para la app móvil
router.post('/auth/login', async (req, res, next) => {
  try {
    const { correo, contrasena } = req.body || {};
    if (!correoValido(correo) || typeof contrasena !== 'string' || contrasena.length < 8 || contrasena.length > 64) {
      return fail(res, 401, 'INVALID_CREDENTIALS');
    }
    const [filas] = await db.query(
      `SELECT u.id_usuario, u.nombre, u.correo, u.contrasena_hash, u.id_estado_cuenta, r.nombre AS rol
              , u.intentos_fallidos, GREATEST(TIMESTAMPDIFF(SECOND, NOW(), u.bloqueo_hasta), 0) AS bloqueo_seg
         FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.correo = ?`,
      [correo.trim().toLowerCase()]
    );
    const usuario = filas[0];
    if (!usuario || usuario.rol !== ROL_USUARIO || !usuario.contrasena_hash) return fail(res, 401, 'INVALID_CREDENTIALS');
    if (usuario.bloqueo_seg > 0) return fail(res, 429, 'ACCOUNT_LOCKED', { retry_after_seconds: usuario.bloqueo_seg });
    if (!await bcrypt.compare(contrasena, usuario.contrasena_hash)) {
      if (usuario.intentos_fallidos + 1 >= MAX_INTENTOS_LOGIN) {
        await db.query('UPDATE usuario SET intentos_fallidos = 0, bloqueo_hasta = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id_usuario = ?', [usuario.id_usuario]);
        return fail(res, 429, 'ACCOUNT_LOCKED', { retry_after_seconds: 900 });
      }
      await db.query('UPDATE usuario SET intentos_fallidos = intentos_fallidos + 1 WHERE id_usuario = ?', [usuario.id_usuario]);
      return fail(res, 401, 'INVALID_CREDENTIALS');
    }
    if (usuario.id_estado_cuenta !== 1) return fail(res, 403, 'ACCOUNT_STATE');
    await db.query('UPDATE usuario SET intentos_fallidos = 0, bloqueo_hasta = NULL, ultimo_acceso = NOW() WHERE id_usuario = ?', [usuario.id_usuario]);
    res.json({ ok: true, token: emitirToken(usuario), usuario: { id: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo } });
  } catch (error) { next(error); }
});

router.post('/auth/logout', userAuth, (req, res) => res.json({ ok: true }));
router.get('/auth/me', userAuth, (req, res) => res.json({ ok: true, usuario: req.usuarioDetalle }));

// Catálogo que utiliza el formulario móvil
router.get('/catalogos/tipos-problema', userAuth, async (req, res, next) => {
  try {
    const [elementos] = await db.query('SELECT id_tipo_problema AS id, nombre FROM tipo_problema WHERE activo = 1 ORDER BY nombre');
    res.json({ ok: true, elementos });
  } catch (error) { next(error); }
});

// RF_06
router.post('/reportes', userAuth, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const b = req.body || {};
    const descripcion = typeof b.descripcion === 'string' ? b.descripcion.trim() : '';
    const tipo = Number(b.id_tipo_problema);
    if (!Number.isInteger(tipo) || tipo <= 0) return fail(res, 400, 'TYPE_REQUIRED');
    if (descripcion.length < 10 || descripcion.length > 500) return fail(res, 400, 'DESCRIPTION_RANGE');
    const latitud = Number(b.latitud), longitud = Number(b.longitud);
    if (b.latitud === null || b.latitud === '' || b.longitud === null || b.longitud === '' ||
        !numeroEnRango(latitud, -90, 90) || !numeroEnRango(longitud, -180, 180)) return fail(res, 400, 'LOCATION_INVALID');
    const imageError = validarImagen(b.imagen_base64, b.imagen_tipo);
    if (imageError) return fail(res, imageError === 'IMAGE_TOO_LARGE' ? 413 : 400, imageError);
    await conn.beginTransaction();
    const [tipos] = await conn.query('SELECT 1 FROM tipo_problema WHERE id_tipo_problema = ? AND activo = 1 FOR SHARE', [tipo]);
    if (!tipos[0]) { await conn.rollback(); return fail(res, 400, 'TYPE_INVALID'); }
    const folio = await folioDisponible(conn);
    const [insertado] = await conn.query(
      `INSERT INTO reporte (folio, id_usuario, id_tipo_problema, descripcion, latitud, longitud, id_estado_reporte, eliminado, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [folio, req.usuario.id, tipo, descripcion, latitud, longitud, ESTADO.PENDIENTE]
    );
    if (b.imagen_base64 !== undefined) {
      const base64 = b.imagen_base64.replace(/^data:image\/(?:jpeg|png);base64,/, '');
      await conn.query('INSERT INTO imagen_reporte (id_reporte, imagen, tipo_mime) VALUES (?, ?, ?)', [insertado.insertId, Buffer.from(base64, 'base64'), b.imagen_tipo]);
    }
    await conn.commit();
    res.status(201).json({ ok: true, id: insertado.insertId, folio });
  } catch (error) {
    try { await conn.rollback(); } catch {}
    next(error);
  } finally { conn.release(); }
});

// RF_08
router.get('/reportes/cercanos', userAuth, async (req, res, next) => {
  try {
    const lat = Number(req.query.latitud), lng = Number(req.query.longitud);
    if (!numeroEnRango(lat, -90, 90) || !numeroEnRango(lng, -180, 180)) return fail(res, 400, 'LOCATION_INVALID');
    const [reportes] = await db.query(
      `SELECT r.id_reporte AS id, r.folio, t.nombre AS tipo, r.descripcion, r.latitud, r.longitud,
              e.nombre AS estado, DATE_FORMAT(r.fecha_creacion, '%Y-%m-%d %H:%i') AS fecha,
              ROUND(6371 * ACOS(LEAST(1, GREATEST(-1, COS(RADIANS(?)) * COS(RADIANS(r.latitud)) *
                COS(RADIANS(r.longitud) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(r.latitud))))), 3) AS distancia_km
         FROM reporte r JOIN tipo_problema t ON t.id_tipo_problema = r.id_tipo_problema
         JOIN estado_reporte e ON e.id_estado_reporte = r.id_estado_reporte
        WHERE r.eliminado = 0 AND r.id_estado_reporte IN (?, ?)
          AND 6371 * ACOS(LEAST(1, GREATEST(-1, COS(RADIANS(?)) * COS(RADIANS(r.latitud)) *
            COS(RADIANS(r.longitud) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(r.latitud))))) <= 1
        ORDER BY distancia_km, r.id_reporte LIMIT 50`,
      [lat, lng, lat, ESTADO.PENDIENTE, ESTADO.EN_PROCESO, lat, lng, lat]
    );
    res.json({ ok: true, radio_km: 1, reportes });
  } catch (error) { next(error); }
});

// RF_09
router.get('/reportes/historial', userAuth, async (req, res, next) => {
  try {
    const pagina = Math.max(Number.parseInt(req.query.pagina, 10) || 1, 1);
    const params = [];
    const [error, where] = filtrosFecha(req.query, params, req.usuario.id);
    if (error) return fail(res, 400, error);
    const folio = req.query.folio ? String(req.query.folio).toUpperCase() : '';
    if (folio && !FOLIO.test(folio)) return fail(res, 400, 'FOLIO_INVALID');
    if (folio) { where.push('r.folio = ?'); params.push(folio); }
    const whereSql = where.join(' AND ');
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM reporte r WHERE ${whereSql}`, params);
    const [reportes] = await db.query(
      `SELECT r.id_reporte AS id, r.folio, t.nombre AS tipo, e.nombre AS estado,
              DATE_FORMAT(r.fecha_creacion, '%Y-%m-%d %H:%i') AS fecha
         FROM reporte r JOIN tipo_problema t ON t.id_tipo_problema = r.id_tipo_problema
         JOIN estado_reporte e ON e.id_estado_reporte = r.id_estado_reporte
        WHERE ${whereSql} ORDER BY r.fecha_creacion DESC, r.id_reporte DESC LIMIT 20 OFFSET ?`,
      [...params, (pagina - 1) * 20]
    );
    res.json({ ok: true, total, pagina, paginas: Math.max(Math.ceil(total / 20), 1), reportes });
  } catch (error) { next(error); }
});

router.get('/reportes/:id', userAuth, async (req, res, next) => {
  try {
    const [filas] = await db.query(
      `SELECT r.id_reporte AS id, r.folio, t.nombre AS tipo, r.descripcion, r.latitud, r.longitud,
              r.id_estado_reporte AS estado_id, e.nombre AS estado,
              DATE_FORMAT(r.fecha_creacion, '%Y-%m-%d %H:%i') AS fecha,
              c.nombre AS criterio_rechazo, h.comentario AS comentario_rechazo,
              EXISTS(SELECT 1 FROM imagen_reporte i WHERE i.id_reporte = r.id_reporte) AS tiene_imagen
         FROM reporte r JOIN tipo_problema t ON t.id_tipo_problema = r.id_tipo_problema
         JOIN estado_reporte e ON e.id_estado_reporte = r.id_estado_reporte
         LEFT JOIN historial_estado_reporte h ON h.id_reporte = r.id_reporte AND h.id_estado_nuevo = ?
         LEFT JOIN criterio_invalido c ON c.id_criterio = h.id_criterio
        WHERE r.id_reporte = ? AND r.id_usuario = ? AND r.eliminado = 0`,
      [ESTADO.RECHAZADO, Number(req.params.id) || 0, req.usuario.id]
    );
    if (!filas[0]) return fail(res, 404, 'NOT_FOUND');
    res.json({ ok: true, reporte: { ...filas[0], tiene_imagen: !!filas[0].tiene_imagen } });
  } catch (error) { next(error); }
});

router.get('/reportes/:id/imagen', userAuth, async (req, res, next) => {
  try {
    const [filas] = await db.query(
      `SELECT i.imagen, i.tipo_mime FROM imagen_reporte i JOIN reporte r ON r.id_reporte = i.id_reporte
        WHERE i.id_reporte = ? AND r.id_usuario = ? AND r.eliminado = 0`,
      [Number(req.params.id) || 0, req.usuario.id]
    );
    if (!filas[0]) return fail(res, 404, 'NOT_FOUND');
    res.type(filas[0].tipo_mime).send(filas[0].imagen);
  } catch (error) { next(error); }
});

// RF_14
router.post('/reportes/:id/solicitud-eliminacion', userAuth, async (req, res, next) => {
  try {
    const motivo = typeof (req.body || {}).motivo === 'string' ? req.body.motivo.trim() : '';
    if (motivo.length < 10 || motivo.length > 300) return fail(res, 400, 'REASON_RANGE');
    const id = Number(req.params.id) || 0;
    const [reportes] = await db.query('SELECT id_reporte FROM reporte WHERE id_reporte = ? AND id_usuario = ? AND eliminado = 0', [id, req.usuario.id]);
    if (!reportes[0]) return fail(res, 404, 'NOT_FOUND');
    const [pendientes] = await db.query("SELECT 1 FROM solicitud_eliminacion_reporte WHERE id_reporte = ? AND id_usuario = ? AND estado = 'Pendiente'", [id, req.usuario.id]);
    if (pendientes[0]) return fail(res, 409, 'REQUEST_PENDING');
    await db.query("INSERT INTO solicitud_eliminacion_reporte (id_reporte, id_usuario, motivo, estado, fecha_solicitud) VALUES (?, ?, ?, 'Pendiente', NOW())", [id, req.usuario.id, motivo]);
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

// RF_20 y RF_30
router.get('/notificaciones/preferencias', userAuth, async (req, res, next) => {
  try {
    const [filas] = await db.query('SELECT notif_estado_reporte, notif_eliminacion_reporte FROM preferencia_notificacion WHERE id_usuario = ?', [req.usuario.id]);
    const p = filas[0] || { notif_estado_reporte: true, notif_eliminacion_reporte: true };
    res.json({ ok: true, preferencias: { cambios_estado: !!p.notif_estado_reporte, eliminacion_reportes: !!p.notif_eliminacion_reporte } });
  } catch (error) { next(error); }
});

router.put('/notificaciones/preferencias', userAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (typeof b.cambios_estado !== 'boolean' || typeof b.eliminacion_reportes !== 'boolean') return fail(res, 400, 'PREFERENCES_INVALID');
    await db.query(
      `INSERT INTO preferencia_notificacion (id_usuario, notif_estado_reporte, notif_eliminacion_reporte)
       VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE notif_estado_reporte = VALUES(notif_estado_reporte), notif_eliminacion_reporte = VALUES(notif_eliminacion_reporte)`,
      [req.usuario.id, b.cambios_estado ? 1 : 0, b.eliminacion_reportes ? 1 : 0]
    );
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.get('/notificaciones', userAuth, async (req, res, next) => {
  try {
    const [notificaciones] = await db.query(
      `SELECT id_alerta AS id, mensaje, fecha_envio AS fecha, leida FROM alerta_usuario
        WHERE id_usuario = ? ORDER BY fecha_envio DESC LIMIT 50`,
      [req.usuario.id]
    );
    res.json({ ok: true, notificaciones });
  } catch (error) { next(error); }
});

router.patch('/notificaciones/:id/leida', userAuth, async (req, res, next) => {
  try {
    const [r] = await db.query('UPDATE alerta_usuario SET leida = 1 WHERE id_alerta = ? AND id_usuario = ?', [Number(req.params.id) || 0, req.usuario.id]);
    if (!r.affectedRows) return fail(res, 404, 'NOT_FOUND');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
