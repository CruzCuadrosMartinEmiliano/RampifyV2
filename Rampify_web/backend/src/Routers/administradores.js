// /api/administradores — RF_24 Invitar administrador (solo Administrador). El registro con el enlace es RF_05 (Routers/registro.js)
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../DB/database');
const { requireAuth } = require('../Services/sesion');
const { correoValido } = require('../Services/validar');
const { enviarInvitacionAdmin, enviarAvisoInvitacion } = require('../Services/correo');
const router = express.Router(), ROL_ADMIN = 3, VIGENCIA_HORAS = 24;
const fail = (res, status, code) => res.status(status).json({ ok: false, code });
router.use(requireAuth('Administrador del sistema'));

// ---------- POST /api/administradores/invitar { correo, contrasena (la del administrador que invita) } ----------
router.post('/invitar', async (req, res, next) => {
  try {
    const { correo, contrasena } = req.body || {};
    if (!correoValido(correo)) return fail(res, 400, 'INVALID_EMAIL');
    if (typeof contrasena !== 'string' || !contrasena) return fail(res, 400, 'PASSWORD_REQUIRED');

    const [[yo]] = await db.query('SELECT nombre, contrasena_hash FROM usuario WHERE id_usuario = ?', [req.usuario.id]);
    if (!await bcrypt.compare(contrasena, yo.contrasena_hash)) return fail(res, 403, 'WRONG_PASSWORD');            // E2
    const [ya] = await db.query('SELECT 1 FROM usuario WHERE correo = ?', [correo]);
    if (ya[0]) return fail(res, 409, 'EMAIL_TAKEN');                                                                // E1
    const [vig] = await db.query('SELECT 1 FROM invitacion_admin WHERE correo = ? AND usada = 0 AND fecha_expiracion > NOW()', [correo]);
    if (vig[0]) return fail(res, 409, 'INVITE_EXISTS');                                                             // E3

    const token = crypto.randomBytes(32).toString('hex');                                                           // el token solo viaja en el enlace; en la BD queda su hash
    const [ins] = await db.query('INSERT INTO invitacion_admin (id_admin, correo, token_hash, fecha_expiracion) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))',
      [req.usuario.id, correo, crypto.createHash('sha256').update(token).digest('hex'), VIGENCIA_HORAS]);
    const enlace = `${process.env.APP_PUBLIC_URL || ''}/html/registro-admin.html?token=${token}`;
    try { await enviarInvitacionAdmin(correo, enlace, yo.nombre); }
    catch (e) {                                                                                                     // E4: se anula la invitación para permitir reintentar
      console.error('Invitación no enviada:', e.message);
      await db.query('DELETE FROM invitacion_admin WHERE id_invitacion = ?', [ins.insertId]);
      return fail(res, 502, 'MAIL_FAILED');
    }
    await db.query(`INSERT INTO bitacora (id_usuario, id_rol, accion, entidad, id_entidad, detalle) VALUES (?, ?, 'INVITAR_ADMIN', 'invitacion', ?, ?)`, [req.usuario.id, ROL_ADMIN, ins.insertId, correo]);

    // Aviso a los demás administradores Activa (si falla, la invitación ya está enviada)
    const [otros] = await db.query('SELECT correo FROM usuario WHERE id_rol = ? AND id_estado_cuenta = 1 AND id_usuario <> ? AND correo IS NOT NULL', [ROL_ADMIN, req.usuario.id]);
    let aviso = true;
    if (otros.length) { try { await enviarAvisoInvitacion(otros.map(o => o.correo), yo.nombre, correo); } catch (e) { aviso = false; console.error('Aviso a administradores no enviado:', e.message); } }
    res.status(201).json({ ok: true, aviso_enviado: aviso });
  } catch (e) { next(e); }
});
module.exports = router;