// /api/registro — RF_04 petición de empleado · RF_05 administrador por invitación
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../DB/database');
const { correoValido, nombreValido, contrasenaValida } = require('../Services/validar');
const router = express.Router();
const fail = (res, status, code) => res.status(status).json({ ok: false, code });
const sha256 = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');   // token_hash (se busca por hash)
const ROL = { EMPLEADO: 2, ADMIN: 3 }, ESTADO = { ACTIVA: 1, PENDIENTE: 2 };

function validarCampos(b, conCorreo) {
  if (!nombreValido(b.nombre) || !contrasenaValida(b.contrasena) || (conCorreo && !correoValido(b.correo))) return 'VALIDATION';
  if (b.acepta_aviso !== true) return 'PRIVACY_REQUIRED';
  return null;
}

// ---------- POST /api/registro/empleado ----------
router.post('/empleado', async (req, res, next) => {
  try {
    const b = req.body || {}, err = validarCampos(b, true);
    if (err) return fail(res, 400, err);
    const [ya] = await db.query('SELECT 1 FROM usuario WHERE correo = ?', [b.correo]);
    if (ya[0]) return fail(res, 409, 'EMAIL_TAKEN');
    await db.query(`INSERT INTO usuario (id_rol, id_estado_cuenta, nombre, correo, contrasena_hash, fecha_aceptacion_aviso) VALUES (?, ?, ?, ?, ?, NOW())`,
      [ROL.EMPLEADO, ESTADO.PENDIENTE, b.nombre.trim(), b.correo, await bcrypt.hash(b.contrasena, 10)]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Busca una invitación vigente y sin usar a partir del token del enlace
async function invitacionVigente(token) {
  if (typeof token !== 'string' || !token) return null;
  const [f] = await db.query('SELECT id_invitacion, correo FROM invitacion_admin WHERE token_hash = ? AND usada = 0 AND fecha_expiracion > NOW()', [sha256(token)]);
  return f[0] || null;
}

// ---------- POST /api/registro/admin/validar ----------
router.post('/admin/validar', async (req, res, next) => {
  try {
    const inv = await invitacionVigente((req.body || {}).token);
    if (!inv) return fail(res, 400, 'INVITE_INVALID');
    res.json({ ok: true, correo: inv.correo });
  } catch (e) { next(e); }
});

// ---------- POST /api/registro/admin ----------
router.post('/admin', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const b = req.body || {}, err = validarCampos(b, false);
    if (err) return fail(res, 400, err);
    await conn.beginTransaction();
    const inv = await invitacionVigente(b.token);
    if (!inv) { await conn.rollback(); return fail(res, 400, 'INVITE_INVALID'); }
    const [ya] = await conn.query('SELECT 1 FROM usuario WHERE correo = ?', [inv.correo]);
    if (ya[0]) { await conn.rollback(); return fail(res, 409, 'EMAIL_TAKEN'); }
    const [ins] = await conn.query(`INSERT INTO usuario (id_rol, id_estado_cuenta, nombre, correo, contrasena_hash, fecha_aceptacion_aviso) VALUES (?, ?, ?, ?, ?, NOW())`,
      [ROL.ADMIN, ESTADO.ACTIVA, b.nombre.trim(), inv.correo, await bcrypt.hash(b.contrasena, 10)]);
    await conn.query('UPDATE invitacion_admin SET usada = 1, id_usuario_creado = ? WHERE id_invitacion = ?', [ins.insertId, inv.id_invitacion]);   // enlace de un solo uso
    await conn.commit();
    res.status(201).json({ ok: true });
  } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
});

module.exports = router;