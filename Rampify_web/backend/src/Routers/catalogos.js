// /api/catalogos — RF_25 Agregar · RF_26 Editar · RF_27 Eliminar elemento de catálogo.
// Escribir: solo Administrador. Leer la lista: cualquier sesión activa (la app móvil la carga al abrir el formulario de reporte).
const express = require('express');
const db = require('../DB/database');
const { requireAuth } = require('../Services/sesion');
const { transaccion, ROL_ADMIN } = require('../Services/eliminacion');
const router = express.Router(), NOMBRE_MIN = 2, NOMBRE_MAX = 60;
const fail = (res, status, code) => res.status(status).json({ ok: false, code });
const admin = requireAuth('Administrador del sistema');

// Catálogos configurables (RNF-ESC-02). Agregar uno nuevo = una línea aquí. Tabla y columna salen de esta lista, nunca del cliente.
const CATALOGOS = {
  'tipos-problema': { tabla: 'tipo_problema', id: 'id_tipo_problema' },
};
const catalogo = (req, res, next) => {
  const c = CATALOGOS[req.params.catalogo];
  if (!c) return fail(res, 404, 'NOT_FOUND');
  req.cat = c; next();
};
const nombreDe = (body) => { const n = (body || {}).nombre; return typeof n === 'string' ? n.trim() : null; };
const longitudValida = (n) => n !== null && n.length >= NOMBRE_MIN && n.length <= NOMBRE_MAX;

// ¿Ya hay un elemento Activo con ese nombre? (la colación de MySQL ignora mayúsculas y acentos). excluirId evita compararlo consigo mismo al editar
async function existe(conn, cat, nombre, excluirId = 0) {
  const [f] = await conn.query(`SELECT 1 FROM ${cat.tabla} WHERE activo = 1 AND nombre = ? AND ${cat.id} <> ? LIMIT 1`, [nombre, excluirId]);
  return !!f[0];
}
// Bloquea el elemento para editarlo o eliminarlo
async function elemento(conn, cat, id) {
  const [f] = await conn.query(`SELECT ${cat.id} AS id, nombre, activo FROM ${cat.tabla} WHERE ${cat.id} = ? FOR UPDATE`, [id]);
  return f[0] || null;
}
const bitacora = (conn, idAdmin, accion, cat, id, detalle) => conn.query(
  'INSERT INTO bitacora (id_usuario, id_rol, accion, entidad, id_entidad, detalle) VALUES (?, ?, ?, ?, ?, ?)', [idAdmin, ROL_ADMIN, accion, cat.tabla, id, detalle || null]);

// ---------- GET /api/catalogos/:catalogo (solo elementos Activo, orden alfabético) ----------
router.get('/:catalogo', requireAuth(), catalogo, async (req, res, next) => {
  try {
    const c = req.cat;
    const [elementos] = await db.query(`SELECT ${c.id} AS id, nombre FROM ${c.tabla} WHERE activo = 1 ORDER BY nombre`);
    res.json({ ok: true, elementos });
  } catch (e) { next(e); }
});

// ---------- RF_25: POST /api/catalogos/:catalogo { nombre } ----------
router.post('/:catalogo', admin, catalogo, (req, res, next) => {
  const nombre = nombreDe(req.body);
  if (!longitudValida(nombre)) return fail(res, 400, 'NAME_RANGE');                                   // E2
  transaccion(res, next, async (conn) => {
    if (await existe(conn, req.cat, nombre)) return ['ITEM_EXISTS', 409];                            // E1
    try {
      const [ins] = await conn.query(`INSERT INTO ${req.cat.tabla} (nombre, activo) VALUES (?, 1)`, [nombre]);   // CA1: se guarda en estado Activo
      await bitacora(conn, req.usuario.id, 'AGREGAR_CATALOGO', req.cat, ins.insertId, nombre);
    } catch (e) { if (e.code === 'ER_DUP_ENTRY') return ['ITEM_EXISTS', 409]; throw e; }              // por si la BD también restringe el nombre
    return null;
  });
});

// ---------- RF_26: POST /api/catalogos/:catalogo/:id/editar { nombre } ----------
router.post('/:catalogo/:id/editar', admin, catalogo, (req, res, next) => {
  const nombre = nombreDe(req.body);
  if (!longitudValida(nombre)) return fail(res, 400, 'NAME_RANGE');                                   // E2
  transaccion(res, next, async (conn) => {
    const x = await elemento(conn, req.cat, Number(req.params.id) || 0);
    if (!x) return ['NOT_FOUND', 404];
    if (!x.activo) return ['ITEM_DELETED', 409];                                                      // precondición: el elemento está Activo
    if (await existe(conn, req.cat, nombre, x.id)) return ['ITEM_EXISTS', 409];                       // E1
    try {
      await conn.query(`UPDATE ${req.cat.tabla} SET nombre = ? WHERE ${req.cat.id} = ?`, [nombre, x.id]);   // los reportes lo muestran por JOIN: ven el nombre nuevo (CA2)
      await bitacora(conn, req.usuario.id, 'EDITAR_CATALOGO', req.cat, x.id, `${x.nombre} → ${nombre}`);
    } catch (e) { if (e.code === 'ER_DUP_ENTRY') return ['ITEM_EXISTS', 409]; throw e; }
    return null;
  });
});

// ---------- RF_27: POST /api/catalogos/:catalogo/:id/eliminar (eliminación lógica; la confirmación la pide el frontend) ----------
router.post('/:catalogo/:id/eliminar', admin, catalogo, (req, res, next) => transaccion(res, next, async (conn) => {
  const x = await elemento(conn, req.cat, Number(req.params.id) || 0);
  if (!x) return ['NOT_FOUND', 404];
  if (!x.activo) return ['ITEM_DELETED', 409];
  await conn.query(`UPDATE ${req.cat.tabla} SET activo = 0 WHERE ${req.cat.id} = ?`, [x.id]);          // los reportes conservan su id_tipo_problema (CA2)
  await bitacora(conn, req.usuario.id, 'ELIMINAR_CATALOGO', req.cat, x.id, x.nombre);
  return null;
}));
module.exports = router;