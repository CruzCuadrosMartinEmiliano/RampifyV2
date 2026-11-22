// /api/auth — RF_01 Iniciar sesión · RF_02 Recuperar contraseña
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../DB/database');
const { abrirSesion, cerrarSesion, requireAuth } = require('../Services/sesion');
const { enviarCodigoRecuperacion } = require('../Services/correo');
const { correoValido, contrasenaValida } = require('../Services/validar');
const router = express.Router();

const MAX_INTENTOS_LOGIN = 5, BLOQUEO_MIN = 15;          // RF_01
const CODIGO_VIGENCIA_MIN = 10, MAX_INTENTOS_CODIGO = 5, MAX_REENVIOS = 3, VENTANA_MIN = 60;   // RF_02
const HASH_FALSO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);
const fail = (res, status, code, extra = {}) => res.status(status).json({ ok: false, code, ...extra });

// ---------- POST /api/auth/login ----------
router.post('/login', async (req, res, next) => {
  try {
    const { correo, contrasena } = req.body || {};
    if (!correoValido(correo) || typeof contrasena !== 'string') return fail(res, 401, 'INVALID_CREDENTIALS');
    const [filas] = await db.query(
      `SELECT u.id_usuario, u.contrasena_hash, u.intentos_fallidos, r.nombre AS rol, e.nombre AS estado,
              GREATEST(TIMESTAMPDIFF(SECOND, NOW(), u.bloqueo_hasta), 0) AS bloqueo_seg
         FROM usuario u JOIN rol r ON r.id_rol = u.id_rol JOIN estado_cuenta e ON e.id_estado_cuenta = u.id_estado_cuenta
        WHERE u.correo = ?`, [correo]);
    const u = filas[0];
    if (!u) { await bcrypt.compare(contrasena, HASH_FALSO); return fail(res, 401, 'INVALID_CREDENTIALS'); }
    if (u.bloqueo_seg > 0) return fail(res, 429, 'ACCOUNT_LOCKED', { retry_after_seconds: u.bloqueo_seg });

    const correcta = u.contrasena_hash && await bcrypt.compare(contrasena, u.contrasena_hash);
    if (!correcta) {
      if (u.intentos_fallidos + 1 >= MAX_INTENTOS_LOGIN) {      // 5.º fallo: bloquear 15 min y reiniciar contador
        await db.query('UPDATE usuario SET intentos_fallidos = 0, bloqueo_hasta = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id_usuario = ?', [BLOQUEO_MIN, u.id_usuario]);
        return fail(res, 429, 'ACCOUNT_LOCKED', { retry_after_seconds: BLOQUEO_MIN * 60 });
      }
      await db.query('UPDATE usuario SET intentos_fallidos = intentos_fallidos + 1 WHERE id_usuario = ?', [u.id_usuario]);
      return fail(res, 401, 'INVALID_CREDENTIALS');
    }
    if (u.estado === 'Eliminada') return fail(res, 401, 'INVALID_CREDENTIALS');
    if (u.estado !== 'Activa') return fail(res, 403, 'ACCOUNT_STATE', { estado_cuenta: u.estado });
    if (u.rol === 'Usuario de la app') return fail(res, 403, 'ROLE_NOT_ALLOWED');   // los ciudadanos usan solo la app móvil

    await db.query('UPDATE usuario SET intentos_fallidos = 0, bloqueo_hasta = NULL, ultimo_acceso = NOW() WHERE id_usuario = ?', [u.id_usuario]);
    abrirSesion(res, u);
    res.json({ ok: true, rol: u.rol });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => { cerrarSesion(res); res.json({ ok: true }); });
router.get('/me', requireAuth(), async (req, res, next) => {     // datos para la barra superior del sistema
  try {
    const [f] = await db.query('SELECT nombre, correo FROM usuario WHERE id_usuario = ?', [req.usuario.id]);
    if (!f[0]) return fail(res, 401, 'UNAUTHENTICATED');
    res.json({ ok: true, id: req.usuario.id, rol: req.usuario.rol, nombre: f[0].nombre, correo: f[0].correo });
  } catch (e) { next(e); }
});

// ---------- POST /api/auth/recuperacion/solicitar (envío inicial y reenvío) ----------
router.post('/recuperacion/solicitar', async (req, res, next) => {
  try {
    const { correo } = req.body || {};
    if (!correoValido(correo)) return fail(res, 400, 'INVALID_EMAIL');
    const [us] = await db.query(`SELECT u.id_usuario FROM usuario u JOIN estado_cuenta e ON e.id_estado_cuenta = u.id_estado_cuenta
                                  WHERE u.correo = ? AND e.nombre = 'Activa'`, [correo]);
    if (!us[0]) return res.json({ ok: true });                 // misma respuesta si el correo no existe; no se envía nada
    const id = us[0].id_usuario;

    // Máximo 3 reenvíos en 60 min = 4 códigos en total (el envío inicial no cuenta como reenvío)
    const [[c]] = await db.query(
      `SELECT COUNT(*) AS total, TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(MIN(fecha_creacion), INTERVAL ? MINUTE)) AS espera
         FROM codigo_verificacion WHERE id_usuario = ? AND tipo = 'Recuperación' AND fecha_creacion > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [VENTANA_MIN, id, VENTANA_MIN]);
    if (c.total >= MAX_REENVIOS + 1) return fail(res, 429, 'RESEND_LIMIT', { retry_after_seconds: Math.max(c.espera, 1) });

    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await db.query("UPDATE codigo_verificacion SET usado = 1 WHERE id_usuario = ? AND tipo = 'Recuperación' AND usado = 0", [id]);
    await db.query(`INSERT INTO codigo_verificacion (id_usuario, tipo, correo_destino, codigo_hash, fecha_expiracion)
                    VALUES (?, 'Recuperación', ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`, [id, correo, await bcrypt.hash(codigo, 10), CODIGO_VIGENCIA_MIN]);
    await enviarCodigoRecuperacion(correo, codigo);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Comprueba el código y cuenta los intentos. Devuelve { error } o { usuario, idCodigo }
async function comprobarCodigo(correo, codigo) {
  if (!correoValido(correo) || !/^\d{6}$/.test(codigo || '')) return { error: ['CODE_INVALID', 400] };
  const [f] = await db.query(
    `SELECT c.id_codigo, c.codigo_hash, c.intentos_incorrectos, c.fecha_expiracion > NOW() AS vigente, u.id_usuario
       FROM codigo_verificacion c JOIN usuario u ON u.id_usuario = c.id_usuario
      WHERE u.correo = ? AND c.tipo = 'Recuperación' AND c.usado = 0 ORDER BY c.id_codigo DESC LIMIT 1`, [correo]);
  const c = f[0];
  if (!c || !c.vigente) return { error: ['CODE_INVALID', 400] };
  if (c.intentos_incorrectos >= MAX_INTENTOS_CODIGO) return { error: ['CODE_BLOCKED', 429] };
  if (!await bcrypt.compare(codigo, c.codigo_hash)) {
    await db.query('UPDATE codigo_verificacion SET intentos_incorrectos = intentos_incorrectos + 1 WHERE id_codigo = ?', [c.id_codigo]);
    return { error: [c.intentos_incorrectos + 1 >= MAX_INTENTOS_CODIGO ? 'CODE_BLOCKED' : 'CODE_INVALID', c.intentos_incorrectos + 1 >= MAX_INTENTOS_CODIGO ? 429 : 400] };
  }
  return { idUsuario: c.id_usuario, idCodigo: c.id_codigo };
}

// ---------- POST /api/auth/recuperacion/verificar ----------
router.post('/recuperacion/verificar', async (req, res, next) => {
  try {
    const { correo, codigo } = req.body || {}, r = await comprobarCodigo(correo, codigo);
    if (r.error) return fail(res, r.error[1], r.error[0]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- POST /api/auth/recuperacion/restablecer ----------
router.post('/recuperacion/restablecer', async (req, res, next) => {
  try {
    const { correo, codigo, nueva_contrasena } = req.body || {};
    if (!contrasenaValida(nueva_contrasena)) return fail(res, 400, 'PASSWORD_RULES');
    const r = await comprobarCodigo(correo, codigo);
    if (r.error) return fail(res, r.error[1], r.error[0]);
    await db.query('UPDATE usuario SET contrasena_hash = ?, intentos_fallidos = 0, bloqueo_hasta = NULL WHERE id_usuario = ?', [await bcrypt.hash(nueva_contrasena, 10), r.idUsuario]);
    await db.query('UPDATE codigo_verificacion SET usado = 1 WHERE id_codigo = ?', [r.idCodigo]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;