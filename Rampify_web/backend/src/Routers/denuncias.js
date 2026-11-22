// /api/denuncias — RF_32 Atender denuncia de usuario (Administrador) · RF_07 Reportar usuario por infracción (Empleado, desde la web)
// Una denuncia apunta al autor de un reporte. El administrador la desestima o aplica Alertar / Banear / Eliminar con las reglas de RF_30 / RF_28 / RF_29.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../DB/database');
const { requireAuth } = require('../Services/sesion');
const { transaccion } = require('../Services/eliminacion');
const mod = require('../Services/moderacion');
const router = express.Router(), PAGINA = 20, EMP = 'Empleado de la asociación', ADM = 'Administrador del sistema', ROL_EMP = 2;
const MOTIVOS = ['Mal uso de la app', 'Incumple Términos y Condiciones'], ESTADOS = ['Pendiente', 'Atendida', 'Desestimada'];
const ACCIONES = ['Desestimar', 'Alertar', 'Banear', 'Eliminar'];
const COMENTARIO_MAX = 300, ALERTA_MIN = 10, ALERTA_MAX = 300;
const fail = (res, status, code) => res.status(status).json({ ok: false, code });
const pag = (q) => Math.max(parseInt(q.pagina) || 1, 1);

// ---------- POST /api/denuncias { id_reporte, motivo, comentario? } — botón "Reportar usuario por infracción" (solo Empleado) ----------
router.post('/', requireAuth(EMP), (req, res, next) => {
  const b = req.body || {}, idReporte = Number(b.id_reporte) || 0, comentario = String(b.comentario || '').trim();
  if (!MOTIVOS.includes(b.motivo)) return fail(res, 400, 'REASON_INVALID');
  if (comentario.length > COMENTARIO_MAX) return fail(res, 400, 'COMMENT_MAX');
  transaccion(res, next, async (conn) => {
    const [f] = await conn.query(
      `SELECT r.id_reporte, r.id_usuario AS autor, u.id_estado_cuenta AS estado_autor, u.id_rol
         FROM reporte r JOIN usuario u ON u.id_usuario = r.id_usuario WHERE r.id_reporte = ? AND r.eliminado = 0 FOR UPDATE`, [idReporte]);
    const r = f[0];
    if (!r) return ['NOT_FOUND', 404];
    if (r.id_rol !== mod.ROL_USUARIO) return ['NOT_APP_USER', 409];                                    // solo se denuncia a Usuarios de la app
    if (r.estado_autor === mod.ESTADO.ELIMINADA) return ['USER_DELETED', 409];                         // sin datos personales: no hay a quién moderar
    const [dup] = await conn.query(`SELECT 1 FROM denuncia_usuario WHERE id_reporte = ? AND id_denunciante = ? LIMIT 1`, [idReporte, req.usuario.id]);
    if (dup.length) return ['ALREADY_REPORTED', 409];
    const [ins] = await conn.query('INSERT INTO denuncia_usuario (id_reporte, id_denunciante, id_denunciado, motivo, comentario) VALUES (?, ?, ?, ?, ?)',
      [idReporte, req.usuario.id, r.autor, b.motivo, comentario || null]);
    await conn.query(`INSERT INTO bitacora (id_usuario, id_rol, accion, entidad, id_entidad, detalle) VALUES (?, ?, 'DENUNCIAR_USUARIO', 'denuncia', ?, ?)`,
      [req.usuario.id, ROL_EMP, ins.insertId, b.motivo]);
    return null;
  });
});

// Todo lo demás es solo del Administrador
router.use(requireAuth(ADM));

// ---------- GET /api/denuncias?estado=&motivo=&pagina= (bandeja: por defecto Pendientes, de la más antigua a la más reciente) ----------
router.get('/', async (req, res, next) => {
  try {
    const p = pag(req.query), estado = ESTADOS.includes(req.query.estado) ? req.query.estado : 'Pendiente';
    const donde = ['d.estado = ?'], par = [estado];
    if (MOTIVOS.includes(req.query.motivo)) { donde.push('d.motivo = ?'); par.push(req.query.motivo); }     // los filtros se aplican en conjunto
    const where = donde.join(' AND ');
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM denuncia_usuario d WHERE ${where}`, par);
    const [denuncias] = await db.query(
      `SELECT d.id_denuncia AS id, r.folio, d.motivo, d.estado, DATE_FORMAT(d.fecha_denuncia, '%Y-%m-%d %H:%i') AS fecha, u.nombre AS denunciado
         FROM denuncia_usuario d JOIN reporte r ON r.id_reporte = d.id_reporte JOIN usuario u ON u.id_usuario = d.id_denunciado
        WHERE ${where} ORDER BY d.fecha_denuncia, d.id_denuncia LIMIT ? OFFSET ?`, [...par, PAGINA, (p - 1) * PAGINA]);
    res.json({ ok: true, total, pagina: p, paginas: Math.max(Math.ceil(total / PAGINA), 1), denuncias });
  } catch (e) { next(e); }
});

// ---------- GET /api/denuncias/:id (detalle: denuncia, denunciado con antecedentes y reporte denunciado) ----------
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id) || 0;
    const [f] = await db.query(
      `SELECT d.id_denuncia AS id, d.motivo, d.comentario, d.estado, DATE_FORMAT(d.fecha_denuncia, '%Y-%m-%d %H:%i') AS fecha, den.nombre AS denunciante,
              d.accion, d.comentario_resolucion, DATE_FORMAT(d.fecha_resolucion, '%Y-%m-%d %H:%i') AS fecha_resolucion, adm.nombre AS administrador,
              u.id_usuario AS usuario_id, u.nombre AS u_nombre, u.id_estado_cuenta AS u_estado_id, ec.nombre AS u_estado,
              r.id_reporte, r.folio, t.nombre AS tipo, r.descripcion, r.latitud, r.longitud, er.nombre AS r_estado, r.eliminado,
              EXISTS(SELECT 1 FROM imagen_reporte i WHERE i.id_reporte = r.id_reporte) AS tiene_imagen
         FROM denuncia_usuario d JOIN usuario u ON u.id_usuario = d.id_denunciado JOIN estado_cuenta ec ON ec.id_estado_cuenta = u.id_estado_cuenta
         JOIN usuario den ON den.id_usuario = d.id_denunciante LEFT JOIN usuario adm ON adm.id_usuario = d.id_admin
         JOIN reporte r ON r.id_reporte = d.id_reporte JOIN tipo_problema t ON t.id_tipo_problema = r.id_tipo_problema JOIN estado_reporte er ON er.id_estado_reporte = r.id_estado_reporte
        WHERE d.id_denuncia = ?`, [id]);
    const x = f[0];
    if (!x) return fail(res, 404, 'NOT_FOUND');
    const [[a]] = await db.query(
      `SELECT (SELECT COUNT(*) FROM denuncia_usuario WHERE id_denunciado = ?) AS denuncias,
              (SELECT COUNT(*) FROM alerta_usuario WHERE id_usuario = ?) AS alertas,
              (SELECT COUNT(*) FROM sancion_cuenta WHERE id_usuario = ?) + (SELECT COUNT(*) FROM bitacora WHERE entidad = 'usuario' AND id_entidad = ? AND accion = 'BANEAR_USUARIO') AS sanciones`, [x.usuario_id, x.usuario_id, x.usuario_id, x.usuario_id]);
    const activa = x.u_estado_id === mod.ESTADO.ACTIVA, pendiente = x.estado === 'Pendiente';
    res.json({ ok: true,
      denuncia: { id: x.id, motivo: x.motivo, comentario: x.comentario, estado: x.estado, fecha: x.fecha, denunciante: x.denunciante,
        accion: x.accion, comentario_resolucion: x.comentario_resolucion, fecha_resolucion: x.fecha_resolucion, administrador: x.administrador },
      denunciado: { nombre: x.u_nombre, estado: x.u_estado, estado_id: x.u_estado_id, total_denuncias: a.denuncias, alertas: a.alertas, sanciones: a.sanciones },
      reporte: { id: x.id_reporte, folio: x.folio, tipo: x.tipo, descripcion: x.descripcion, latitud: x.latitud, longitud: x.longitud, estado: x.r_estado, eliminado: !!x.eliminado, tiene_imagen: !!x.tiene_imagen },
      acciones: { puede_resolver: pendiente, disponibles: !pendiente ? [] : activa ? ACCIONES : ['Desestimar'] } });   // E2: cuenta no Activa → solo Desestimar
  } catch (e) { next(e); }
});

// ---------- GET /api/denuncias/:id/imagen (imagen del reporte denunciado; sigue disponible aunque el reporte se elimine) ----------
router.get('/:id/imagen', async (req, res, next) => {
  try {
    const [f] = await db.query(`SELECT i.imagen, i.tipo_mime FROM imagen_reporte i JOIN denuncia_usuario d ON d.id_reporte = i.id_reporte WHERE d.id_denuncia = ?`, [Number(req.params.id) || 0]);
    if (!f[0]) return fail(res, 404, 'NOT_FOUND');
    res.set({ 'Content-Type': f[0].tipo_mime, 'Cache-Control': 'private, max-age=300' }).send(f[0].imagen);
  } catch (e) { next(e); }
});

// ---------- POST /api/denuncias/:id/resolver { accion, comentario?, contrasena? (solo Eliminar: la del administrador) } ----------
router.post('/:id/resolver', async (req, res, next) => {
  try {
    const b = req.body || {}, accion = b.accion, comentario = String(b.comentario || '').trim();
    if (!ACCIONES.includes(accion)) return fail(res, 400, 'ACTION_INVALID');
    if (comentario.length > COMENTARIO_MAX) return fail(res, 400, 'COMMENT_MAX');
    if (accion === 'Alertar' && (comentario.length < ALERTA_MIN || comentario.length > ALERTA_MAX)) return fail(res, 400, 'MESSAGE_RANGE');   // E3 · RF_30: el comentario es el mensaje de la alerta
    if (accion === 'Eliminar') {                                                                       // E3 · RF_29: contraseña del administrador
      if (typeof b.contrasena !== 'string' || !b.contrasena) return fail(res, 400, 'PASSWORD_REQUIRED');
      const [[yo]] = await db.query('SELECT contrasena_hash FROM usuario WHERE id_usuario = ?', [req.usuario.id]);
      if (!yo || !yo.contrasena_hash || !await bcrypt.compare(b.contrasena, yo.contrasena_hash)) return fail(res, 403, 'WRONG_PASSWORD');
    }
    transaccion(res, next, async (conn) => {
      const [f] = await conn.query('SELECT id_denunciado, motivo, estado FROM denuncia_usuario WHERE id_denuncia = ? FOR UPDATE', [Number(req.params.id) || 0]);
      const d = f[0];
      if (!d) return ['NOT_FOUND', 404];
      if (d.estado !== 'Pendiente') return ['ALREADY_RESOLVED', 409];                                  // E4: no se registra una segunda resolución
      let estadoFinal = 'Desestimada';
      if (accion !== 'Desestimar') {
        const u = await mod.usuario(conn, d.id_denunciado);
        if (!u) return ['NOT_FOUND', 404];
        if (u.estado !== mod.ESTADO.ACTIVA) return ['ACCOUNT_NOT_ACTIVE', 409];                        // E2: solo se puede desestimar
        if (accion === 'Alertar') await mod.alertar(conn, req.usuario.id, u, comentario);
        else if (accion === 'Banear') await mod.banear(conn, req.usuario.id, u, d.motivo, comentario);
        else await mod.eliminar(conn, req.usuario.id, u);
        estadoFinal = 'Atendida';
      }
      await conn.query('UPDATE denuncia_usuario SET estado = ?, accion = ?, comentario_resolucion = ?, id_admin = ?, fecha_resolucion = NOW() WHERE id_denuncia = ?',
        [estadoFinal, accion, comentario || null, req.usuario.id, Number(req.params.id)]);
      await mod.bitacora(conn, req.usuario.id, 'RESOLVER_DENUNCIA', d.id_denunciado, `Denuncia ${req.params.id}: ${accion}`);
      return null;
    });
  } catch (e) { next(e); }
});
module.exports = router;