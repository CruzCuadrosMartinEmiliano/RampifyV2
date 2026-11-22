// /api/dashboard — RF_31 Consultar dashboard (solo lectura; Empleado y Administrador)
const express = require('express');
const db = require('../DB/database');
const { requireAuth } = require('../Services/sesion');
const router = express.Router();
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fail = (res, status, code) => res.status(status).json({ ok: false, code });

router.get('/', requireAuth('Empleado de la asociación', 'Administrador del sistema'), async (req, res, next) => {
  try {
    const [[hoy]] = await db.query("SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 29 DAY), '%Y-%m-%d') AS d, DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS h");
    const desde = req.query.desde || hoy.d, hasta = req.query.hasta || hoy.h;   // por defecto: últimos 30 días contando hoy
    if (!FECHA.test(desde) || !FECHA.test(hasta)) return fail(res, 400, 'DATE_INVALID');
    if (hasta < desde) return fail(res, 400, 'DATE_RANGE');

    let donde = 'r.eliminado = 0 AND r.fecha_creacion >= ? AND r.fecha_creacion < DATE_ADD(?, INTERVAL 1 DAY)';
    const p = [desde, hasta];
    if (req.query.estado) { donde += ' AND r.id_estado_reporte = ?'; p.push(Number(req.query.estado) || 0); }
    if (req.query.tipo)   { donde += ' AND r.id_tipo_problema = ?';  p.push(Number(req.query.tipo) || 0); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM reporte r WHERE ${donde}`, p);
    const [estados] = await db.query('SELECT id_estado_reporte AS id, nombre FROM estado_reporte ORDER BY id_estado_reporte');
    const [tipos] = await db.query('SELECT id_tipo_problema AS id, nombre, activo FROM tipo_problema ORDER BY nombre');   // incluye los eliminados (RF_27 CA2: los reportes conservan su tipo)
    const [pe] = await db.query(`SELECT r.id_estado_reporte AS id, COUNT(*) AS total FROM reporte r WHERE ${donde} GROUP BY r.id_estado_reporte`, p);
    const [pt] = await db.query(`SELECT r.id_tipo_problema AS id, COUNT(*) AS total FROM reporte r WHERE ${donde} GROUP BY r.id_tipo_problema`, p);
    const [por_dia] = await db.query(`SELECT DATE_FORMAT(r.fecha_creacion, '%Y-%m-%d') AS fecha, COUNT(*) AS total FROM reporte r WHERE ${donde} GROUP BY fecha ORDER BY fecha`, p);
    const [puntos] = await db.query(`SELECT ROUND(r.latitud, 3) AS lat, ROUND(r.longitud, 3) AS lng, COUNT(*) AS total FROM reporte r WHERE ${donde} GROUP BY lat, lng ORDER BY total DESC LIMIT 500`, p);
    const [[{ usuarios_activos }]] = await db.query(
      `SELECT COUNT(*) AS usuarios_activos FROM usuario u JOIN rol ro ON ro.id_rol = u.id_rol JOIN estado_cuenta e ON e.id_estado_cuenta = u.id_estado_cuenta
        WHERE ro.nombre = 'Usuario de la app' AND e.nombre = 'Activa'`);
    const tiposGrafica = tipos.filter(t => t.activo || pt.some(f => f.id === t.id));                      // un tipo eliminado solo aparece si tiene reportes en el filtro
    const cuenta = (lista, filas) => lista.map(x => ({ nombre: x.nombre, total: (filas.find(f => f.id === x.id) || {}).total || 0 }));

    res.json({ ok: true, desde, hasta, total, usuarios_activos, por_dia, puntos,
      por_estado: cuenta(estados, pe), por_tipo: cuenta(tiposGrafica, pt), catalogos: { estados, tipos } });
  } catch (e) { next(e); }
});
module.exports = router;