// /api/reportes — RF_10 Consultar · RF_11 Actualizar estado (Empleado) · RF_13 Rechazar (Administrador)
const express = require('express');
const db = require('../DB/database');
const { requireAuth } = require('../Services/sesion');
const { transaccion, eliminarReporte } = require('../Services/eliminacion');
const router = express.Router();
const EMP = 'Empleado de la asociación', ADM = 'Administrador del sistema', ROL_ID = { [EMP]: 2, [ADM]: 3 };
const ESTADO = { PENDIENTE: 1, EN_PROCESO: 2, SOLUCIONADO: 3, RECHAZADO: 4 };
const TRANSICIONES = { 1: [2], 2: [3], 3: [2] };                 // Pendiente→En proceso→Solucionado→(reabrir) En proceso
const PAGINA = 20, FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fail = (res, status, code, extra = {}) => res.status(status).json({ ok: false, code, ...extra });
const ambos = requireAuth(EMP, ADM);

// ---------- GET /api/reportes (lista filtrada, 20 por página, del más reciente al más antiguo) ----------
router.get('/', ambos, async (req, res, next) => {
  try {
    const { desde, hasta, estado, tipo } = req.query, pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const folio = String(req.query.folio || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12);
    if ((desde && !FECHA.test(desde)) || (hasta && !FECHA.test(hasta))) return fail(res, 400, 'DATE_INVALID');
    if (desde && hasta && hasta < desde) return fail(res, 400, 'DATE_RANGE');
    let donde = 'r.eliminado = 0'; const p = [];
    if (desde) { donde += ' AND r.fecha_creacion >= ?'; p.push(desde); }
    if (hasta) { donde += ' AND r.fecha_creacion < DATE_ADD(?, INTERVAL 1 DAY)'; p.push(hasta); }
    else donde += ' AND r.fecha_creacion < DATE_ADD(CURDATE(), INTERVAL 1 DAY)';          // sin fecha final: tope = hoy
    if (folio)  { donde += ' AND r.folio LIKE ?'; p.push(`%${folio}%`); }
    if (estado) { donde += ' AND r.id_estado_reporte = ?'; p.push(Number(estado) || 0); }
    if (tipo)   { donde += ' AND r.id_tipo_problema = ?';  p.push(Number(tipo) || 0); }
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM reporte r WHERE ${donde}`, p);
    const [reportes] = await db.query(
      `SELECT r.id_reporte AS id, r.folio, t.nombre AS tipo, e.nombre AS estado, DATE_FORMAT(r.fecha_creacion, '%Y-%m-%d %H:%i') AS fecha
         FROM reporte r JOIN tipo_problema t ON t.id_tipo_problema = r.id_tipo_problema JOIN estado_reporte e ON e.id_estado_reporte = r.id_estado_reporte
        WHERE ${donde} ORDER BY r.fecha_creacion DESC, r.id_reporte DESC LIMIT ? OFFSET ?`, [...p, PAGINA, (pagina - 1) * PAGINA]);
    const [estados] = await db.query('SELECT id_estado_reporte AS id, nombre FROM estado_reporte ORDER BY id_estado_reporte');
    const [tipos] = await db.query('SELECT id_tipo_problema AS id, nombre FROM tipo_problema ORDER BY nombre');
    res.json({ ok: true, total, pagina, paginas: Math.max(Math.ceil(total / PAGINA), 1), reportes, catalogos: { estados, tipos } });
  } catch (e) { next(e); }
});

// ---------- GET /api/reportes/:id (detalle con historial de estados) ----------
router.get('/:id', ambos, async (req, res, next) => {
  try {
    const id = Number(req.params.id) || 0;
    const [f] = await db.query(
      `SELECT r.id_reporte AS id, r.folio, t.nombre AS tipo, r.descripcion, r.latitud, r.longitud, r.id_estado_reporte AS estado_id, e.nombre AS estado,
              DATE_FORMAT(r.fecha_creacion, '%Y-%m-%d %H:%i') AS fecha, u.nombre AS autor, EXISTS(SELECT 1 FROM imagen_reporte i WHERE i.id_reporte = r.id_reporte) AS tiene_imagen
         FROM reporte r JOIN tipo_problema t ON t.id_tipo_problema = r.id_tipo_problema JOIN estado_reporte e ON e.id_estado_reporte = r.id_estado_reporte
         JOIN usuario u ON u.id_usuario = r.id_usuario WHERE r.id_reporte = ? AND r.eliminado = 0`, [id]);
    if (!f[0]) return fail(res, 404, 'NOT_FOUND');
    const [historial] = await db.query(
      `SELECT ea.nombre AS estado_anterior, en.nombre AS estado_nuevo, u.nombre AS responsable, c.nombre AS criterio, h.comentario,
              DATE_FORMAT(h.fecha_cambio, '%Y-%m-%d %H:%i') AS fecha
         FROM historial_estado_reporte h LEFT JOIN estado_reporte ea ON ea.id_estado_reporte = h.id_estado_anterior
         JOIN estado_reporte en ON en.id_estado_reporte = h.id_estado_nuevo JOIN usuario u ON u.id_usuario = h.id_responsable
         LEFT JOIN criterio_invalido c ON c.id_criterio = h.id_criterio WHERE h.id_reporte = ? ORDER BY h.fecha_cambio, h.id_historial`, [id]);
    const r = f[0], esEmp = req.usuario.rol === EMP;
    const [crit] = await db.query('SELECT id_criterio AS id, nombre FROM criterio_invalido WHERE id_criterio <= 3 ORDER BY id_criterio');
    const [nombres] = await db.query('SELECT id_estado_reporte AS id, nombre FROM estado_reporte');
    res.json({ ok: true, reporte: { ...r, tiene_imagen: !!r.tiene_imagen }, historial,
      acciones: {                                                // qué puede hacer quien consulta
        estados_disponibles: esEmp ? (TRANSICIONES[r.estado_id] || []).map(i => nombres.find(n => n.id === i)) : [],
        puede_rechazar: !esEmp && r.estado_id === ESTADO.PENDIENTE, puede_eliminar: !esEmp, puede_denunciar: esEmp, criterios: crit } });   // puede_denunciar: botón "Reportar usuario por infracción" (RF_07 → RF_32)
  } catch (e) { next(e); }
});

// ---------- GET /api/reportes/:id/imagen ----------
router.get('/:id/imagen', ambos, async (req, res, next) => {
  try {
    const [f] = await db.query(`SELECT i.imagen, i.tipo_mime FROM imagen_reporte i JOIN reporte r ON r.id_reporte = i.id_reporte WHERE i.id_reporte = ? AND r.eliminado = 0`, [Number(req.params.id) || 0]);
    if (!f[0]) return fail(res, 404, 'NOT_FOUND');
    res.set({ 'Content-Type': f[0].tipo_mime, 'Cache-Control': 'private, max-age=300' }).send(f[0].imagen);
  } catch (e) { next(e); }
});

// Ejecuta un cambio de estado dentro de una transacción (bloquea la fila para evitar cambios simultáneos)
async function cambiarEstado(req, res, next, reglas) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [f] = await conn.query('SELECT id_estado_reporte AS estado, eliminado FROM reporte WHERE id_reporte = ? FOR UPDATE', [Number(req.params.id) || 0]);
    const id = Number(req.params.id), r = f[0];
    const error = !r || r.eliminado ? ['NOT_FOUND', 404, {}] : reglas.validar(r.estado);
    if (error) { await conn.rollback(); return fail(res, error[1], error[0], error[2]); }
    const { nuevo, comentario, criterio, accion } = reglas.datos;
    await conn.query('UPDATE reporte SET id_estado_reporte = ? WHERE id_reporte = ?', [nuevo, id]);
    await conn.query(`INSERT INTO historial_estado_reporte (id_reporte, id_estado_anterior, id_estado_nuevo, id_responsable, id_criterio, comentario) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, r.estado, nuevo, req.usuario.id, criterio || null, comentario || null]);
    await conn.query(`INSERT INTO bitacora (id_usuario, id_rol, accion, entidad, id_entidad, detalle) VALUES (?, ?, ?, 'reporte', ?, ?)`,
      [req.usuario.id, ROL_ID[req.usuario.rol], accion, id, `Estado ${r.estado} → ${nuevo}`]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
}

// ---------- POST /api/reportes/:id/estado (RF_11, solo Empleado) ----------
router.post('/:id/estado', requireAuth(EMP), (req, res, next) => {
  const nuevo = Number((req.body || {}).estado), comentario = String((req.body || {}).comentario || '').trim();
  if (comentario.length > 300) return fail(res, 400, 'COMMENT_TOO_LONG');
  cambiarEstado(req, res, next, { datos: { nuevo, comentario, accion: 'ACTUALIZAR_ESTADO_REPORTE' }, validar: (actual) =>
    actual === ESTADO.RECHAZADO ? ['REPORT_LOCKED', 409, {}] :
    !(TRANSICIONES[actual] || []).includes(nuevo) ? ['INVALID_TRANSITION', 409, { disponibles: TRANSICIONES[actual] || [] }] : null });
});

// ---------- POST /api/reportes/:id/rechazar (RF_13, solo Administrador) ----------
router.post('/:id/rechazar', requireAuth(ADM), (req, res, next) => {
  const criterio = Number((req.body || {}).id_criterio), comentario = String((req.body || {}).comentario || '').trim();
  cambiarEstado(req, res, next, { datos: { nuevo: ESTADO.RECHAZADO, comentario, criterio, accion: 'RECHAZAR_REPORTE' }, validar: (actual) =>
    actual !== ESTADO.PENDIENTE ? ['NOT_PENDING', 409, {}] :
    ![1, 2, 3].includes(criterio) ? ['CRITERIA_INVALID', 400, {}] :
    comentario.length < 10 || comentario.length > 200 ? ['COMMENT_RANGE', 400, {}] : null });
});

// ---------- POST /api/reportes/:id/eliminar (RF_12 Forma 2, solo Administrador) { id_criterio: 1-3 } ----------
router.post('/:id/eliminar', requireAuth(ADM), (req, res, next) => {
  const criterio = Number((req.body || {}).id_criterio);
  if (![1, 2, 3].includes(criterio)) return fail(res, 400, 'CRITERIA_INVALID');
  transaccion(res, next, (conn) => eliminarReporte(conn, Number(req.params.id) || 0, criterio, req.usuario.id, 'ELIMINAR_REPORTE'));
});

module.exports = router;