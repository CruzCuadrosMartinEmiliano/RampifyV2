// /api/perfil — RF_15 Eliminar cuenta propia · RF_16 Cancelar eliminación · RF_17 Actualizar correo · RF_18 Actualizar contraseña (Empleado y Administrador)
// RF_19 Cerrar sesión ya existe en /api/auth/logout. RF_20 (notificaciones) es solo de la app móvil.
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../DB/database');
const { requireAuth } = require('../Services/sesion');
const { transaccion } = require('../Services/eliminacion');
const { enviarCodigoCorreo } = require('../Services/correo');
const { correoValido, contrasenaValida } = require('../Services/validar');
const router = express.Router();

const TIPO_CODIGO = 'Cambio de correo', FECHA_ELIMINACION = 'fecha_eliminacion_programada';
const CODIGO_VIGENCIA_MIN = 10, MAX_INTENTOS_CODIGO = 5, MAX_REENVIOS = 3, VENTANA_MIN = 60;   // RF_17
const GRACIA_DIAS = 30;                                                                          // RF_15
const fail = (res, status, code, extra = {}) => res.status(status).json({ ok: false, code, ...extra });
router.use(requireAuth('Empleado de la asociación', 'Administrador del sistema'));

const hashDe = async (id) => { const [[u]] = await db.query('SELECT contrasena_hash FROM usuario WHERE id_usuario = ?', [id]); return u ? u.contrasena_hash : null; };
const coincide = async (plano, hash) => typeof plano === 'string' && plano !== '' && !!hash && bcrypt.compare(plano, hash);
const fechaProgramada = async (id) => { const [[u]] = await db.query(`SELECT DATE_FORMAT(${FECHA_ELIMINACION}, '%Y-%m-%d %H:%i') AS fecha FROM usuario WHERE id_usuario = ?`, [id]); return u ? u.fecha : null; };

// ---------- GET /api/perfil (datos de la cuenta y eliminación programada) ----------
router.get('/', async (req, res, next) => {
  try {
    const [f] = await db.query(
      `SELECT u.nombre, u.correo, r.nombre AS rol, DATE_FORMAT(u.fecha_registro, '%Y-%m-%d') AS registro,
              DATE_FORMAT(u.${FECHA_ELIMINACION}, '%Y-%m-%d %H:%i') AS eliminacion
         FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ?`, [req.usuario.id]);
    if (!f[0]) return fail(res, 401, 'UNAUTHENTICATED');
    res.json({ ok: true, ...f[0] });
  } catch (e) { next(e); }
});

// ================= RF_17 Actualizar correo =================
// Emite un código de 6 dígitos para el correo nuevo. Devuelve null o [code, status, extra]
async function emitirCodigo(idUsuario, correoNuevo) {
  // Máximo 3 reenvíos en 60 min = 4 códigos en total (el envío inicial no cuenta como reenvío)
  const [[c]] = await db.query(
    `SELECT COUNT(*) AS total, TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(MIN(fecha_creacion), INTERVAL ? MINUTE)) AS espera
       FROM codigo_verificacion WHERE id_usuario = ? AND tipo = ? AND fecha_creacion > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [VENTANA_MIN, idUsuario, TIPO_CODIGO, VENTANA_MIN]);
  if (c.total >= MAX_REENVIOS + 1) return ['RESEND_LIMIT', 429, { retry_after_seconds: Math.max(c.espera, 1) }];       // E6

  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  try { await enviarCodigoCorreo(correoNuevo, codigo); }                                  // si el correo falla, no cambia nada y se puede reintentar
  catch (e) { console.error('Código de cambio de correo no enviado:', e.message); return ['MAIL_FAILED', 502, {}]; }
  await db.query('UPDATE codigo_verificacion SET usado = 1 WHERE id_usuario = ? AND tipo = ? AND usado = 0', [idUsuario, TIPO_CODIGO]);   // E5: el reenvío invalida el anterior
  await db.query(`INSERT INTO codigo_verificacion (id_usuario, tipo, correo_destino, codigo_hash, fecha_expiracion)
                  VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`, [idUsuario, TIPO_CODIGO, correoNuevo, await bcrypt.hash(codigo, 10), CODIGO_VIGENCIA_MIN]);
  return null;
}
// Último código sin usar del cambio de correo en curso (si lo hay)
async function codigoPendiente(idUsuario) {
  const [f] = await db.query(
    `SELECT id_codigo, codigo_hash, correo_destino, intentos_incorrectos, fecha_expiracion > NOW() AS vigente
       FROM codigo_verificacion WHERE id_usuario = ? AND tipo = ? AND usado = 0 ORDER BY id_codigo DESC LIMIT 1`, [idUsuario, TIPO_CODIGO]);
  return f[0] || null;
}

// ---------- POST /api/perfil/correo/solicitar { correo, contrasena } ----------
router.post('/correo/solicitar', async (req, res, next) => {
  try {
    const { correo, contrasena } = req.body || {};
    if (!correoValido(correo)) return fail(res, 400, 'INVALID_EMAIL');
    if (typeof contrasena !== 'string' || !contrasena) return fail(res, 400, 'PASSWORD_REQUIRED');
    if (!await coincide(contrasena, await hashDe(req.usuario.id))) return fail(res, 403, 'WRONG_PASSWORD');          // E2
    const [ya] = await db.query('SELECT 1 FROM usuario WHERE correo = ?', [correo]);
    if (ya[0]) return fail(res, 409, 'EMAIL_TAKEN');                                                                // E1
    const err = await emitirCodigo(req.usuario.id, correo);
    if (err) return fail(res, err[1], err[0], err[2]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- POST /api/perfil/correo/reenviar (al mismo correo nuevo del cambio en curso) ----------
router.post('/correo/reenviar', async (req, res, next) => {
  try {
    const p = await codigoPendiente(req.usuario.id);
    if (!p) return fail(res, 409, 'NO_PENDING');
    const err = await emitirCodigo(req.usuario.id, p.correo_destino);
    if (err) return fail(res, err[1], err[0], err[2]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- POST /api/perfil/correo/confirmar { codigo } ----------
router.post('/correo/confirmar', async (req, res, next) => {
  try {
    const { codigo } = req.body || {};
    if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) return fail(res, 400, 'CODE_INVALID');
    const c = await codigoPendiente(req.usuario.id);
    if (!c) return fail(res, 409, 'NO_PENDING');
    if (!c.vigente) return fail(res, 400, 'CODE_INVALID');                                                          // E3: vencido
    if (c.intentos_incorrectos >= MAX_INTENTOS_CODIGO) return fail(res, 429, 'CODE_BLOCKED');                       // E4: solo permite reenviar
    if (!await bcrypt.compare(codigo, c.codigo_hash)) {
      await db.query('UPDATE codigo_verificacion SET intentos_incorrectos = intentos_incorrectos + 1 WHERE id_codigo = ?', [c.id_codigo]);
      return c.intentos_incorrectos + 1 >= MAX_INTENTOS_CODIGO ? fail(res, 429, 'CODE_BLOCKED') : fail(res, 400, 'CODE_INVALID');   // E3 / E4
    }
    await transaccion(res, next, async (conn) => {
      const [ya] = await conn.query('SELECT 1 FROM usuario WHERE correo = ? AND id_usuario <> ?', [c.correo_destino, req.usuario.id]);
      if (ya[0]) return ['EMAIL_TAKEN', 409];                                                                       // alguien lo registró mientras tanto
      try { await conn.query('UPDATE usuario SET correo = ? WHERE id_usuario = ?', [c.correo_destino, req.usuario.id]); }
      catch (e) { if (e.code === 'ER_DUP_ENTRY') return ['EMAIL_TAKEN', 409]; throw e; }
      await conn.query('UPDATE codigo_verificacion SET usado = 1 WHERE id_usuario = ? AND tipo = ? AND usado = 0', [req.usuario.id, TIPO_CODIGO]);
      return null;
    });
  } catch (e) { next(e); }
});

// ================= RF_18 Actualizar contraseña =================
// ---------- POST /api/perfil/contrasena { actual, nueva, confirmacion } ----------
router.post('/contrasena', async (req, res, next) => {
  try {
    const { actual, nueva, confirmacion } = req.body || {};
    if (typeof actual !== 'string' || !actual) return fail(res, 400, 'PASSWORD_REQUIRED');
    const hash = await hashDe(req.usuario.id);
    if (!await coincide(actual, hash)) return fail(res, 403, 'WRONG_PASSWORD');                                     // E1
    if (!contrasenaValida(nueva)) return fail(res, 400, 'PASSWORD_RULES');                                          // E4
    if (nueva !== confirmacion) return fail(res, 400, 'PASSWORD_MISMATCH');                                         // E3
    if (await bcrypt.compare(nueva, hash)) return fail(res, 409, 'SAME_PASSWORD');                                  // E2
    await db.query('UPDATE usuario SET contrasena_hash = ? WHERE id_usuario = ?', [await bcrypt.hash(nueva, 10), req.usuario.id]);   // CA2: siempre cifrada
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ================= RF_15 Eliminar cuenta propia · RF_16 Cancelar eliminación =================
// La cuenta sigue Activa durante el periodo de gracia; Services/mantenimiento.js ejecuta la eliminación al llegar la fecha (RF_15 CA2).
// ---------- POST /api/perfil/eliminacion { contrasena } ----------
router.post('/eliminacion', async (req, res, next) => {
  try {
    const { contrasena } = req.body || {};
    if (typeof contrasena !== 'string' || !contrasena) return fail(res, 400, 'PASSWORD_REQUIRED');
    if (!await coincide(contrasena, await hashDe(req.usuario.id))) return fail(res, 403, 'WRONG_PASSWORD');         // E1: no programa la eliminación
    const [r] = await db.query(
      `UPDATE usuario SET ${FECHA_ELIMINACION} = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE id_usuario = ? AND ${FECHA_ELIMINACION} IS NULL AND id_estado_cuenta = 1`,
      [GRACIA_DIAS, req.usuario.id]);
    const fecha = await fechaProgramada(req.usuario.id);
    if (!r.affectedRows) return fecha ? fail(res, 409, 'ALREADY_SCHEDULED', { fecha }) : fail(res, 409, 'INVALID_STATE');   // E3: ya programada
    res.json({ ok: true, fecha });
  } catch (e) { next(e); }
});

// ---------- POST /api/perfil/eliminacion/cancelar ----------
router.post('/eliminacion/cancelar', async (req, res, next) => {
  try {
    const [r] = await db.query(
      `UPDATE usuario SET ${FECHA_ELIMINACION} = NULL WHERE id_usuario = ? AND ${FECHA_ELIMINACION} IS NOT NULL AND ${FECHA_ELIMINACION} > NOW()`, [req.usuario.id]);
    if (!r.affectedRows) return fail(res, 409, 'NOT_SCHEDULED');
    res.json({ ok: true });
  } catch (e) { next(e); }
});
module.exports = router;