/* ===== api.js — llamadas al backend. Devuelve siempre { ok, status, data } ===== */
Rampify.api = (() => {
  const { API_BASE_URL, ENDPOINTS, TIMEOUT_MS, USE_MOCK } = Rampify.CONFIG;

  async function send(path, body, method = 'POST') {
    if (USE_MOCK) return mock(path, body);
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE_URL + path, { method, credentials: 'include', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      // Sesión vencida o cerrada por el servidor en una pantalla interna → login con aviso (RNF-SEG-04)
      if (res.status === 401 && document.body.dataset.role && path !== ENDPOINTS.login && path !== ENDPOINTS.logout && path !== ENDPOINTS.me) {
        location.href = '../login.html?expirada=1';
      }
      return { ok: res.ok && data.ok !== false, status: res.status, data };
    } catch (e) { return { ok: false, status: 0, data: { code: 'NETWORK' } }; }
    finally { clearTimeout(timer); }
  }

  const post = (p, b) => send(p, b, 'POST'), get = (p) => send(p, null, 'GET');

  /* Simulación para probar el frontend sin backend (USE_MOCK:true). Eliminar al conectar. */
  function mock(path, b) {
    const res = (ok, data = {}) => ({ ok, status: ok ? 200 : 400, data: ok ? data : { code: data.code || 'UNKNOWN', ...data } });
    let r;
    if (path === ENDPOINTS.login) r = b.correo === 'admin@rampify.mx' && b.contrasena === 'Demo1234' ? res(true, { rol: 'Administrador del sistema' }) : res(false, { code: 'INVALID_CREDENTIALS' });
    else if (path === ENDPOINTS.recoveryVerify) r = b.codigo === '123456' ? res(true) : res(false, { code: 'CODE_INVALID' });
    else if (path === ENDPOINTS.adminInviteCheck) r = b.token === 'demo' ? res(true, { correo: 'nuevo.admin@rampify.mx' }) : res(false, { code: 'INVITE_INVALID' });
    else if (path === ENDPOINTS.registerEmployee && b.correo === 'ya@rampify.mx') r = res(false, { code: 'EMAIL_TAKEN' });
    else r = res(true);
    return new Promise(ok => setTimeout(() => ok(r), 400));
  }

  return {                                   // nombres de campo = columnas/variables de la BD
    login:           ({ correo, contrasena })                     => post(ENDPOINTS.login, { correo, contrasena }),
    recoveryRequest: ({ correo })                                 => post(ENDPOINTS.recoveryRequest, { correo }),
    recoveryVerify:  ({ correo, codigo })                         => post(ENDPOINTS.recoveryVerify, { correo, codigo }),
    me:        () => get(ENDPOINTS.me),
    logout:    () => post(ENDPOINTS.logout, {}),
    dashboard: (f) => get(ENDPOINTS.dashboard + '?' + new URLSearchParams(Object.entries(f || {}).filter(([, v]) => v))),   // { desde, hasta, estado, tipo }
    reportes:      (f) => get(ENDPOINTS.reportes + '?' + new URLSearchParams(Object.entries(f || {}).filter(([, v]) => v))),   // { desde, hasta, folio, estado, tipo, pagina }
    reporte:       (id) => get(`${ENDPOINTS.reportes}/${id}`),
    reporteEstado: (id, b) => post(`${ENDPOINTS.reportes}/${id}/estado`, b),        // { estado, comentario }
    reporteRechazar: (id, b) => post(`${ENDPOINTS.reportes}/${id}/rechazar`, b),    // { id_criterio, comentario }
    solicitudes:        (pagina) => get(`${ENDPOINTS.solicitudes}?pagina=${pagina || 1}`),
    solicitudAprobar:   (id) => post(`${ENDPOINTS.solicitudes}/${id}/aprobar`, {}),
    solicitudRechazar:  (id, b) => post(`${ENDPOINTS.solicitudes}/${id}/rechazar`, b),   // { motivo }
    reporteEliminar:    (id, b) => post(`${ENDPOINTS.reportes}/${id}/eliminar`, b),      // { id_criterio }
    empSolicitudes: (pagina) => get(`${ENDPOINTS.empleados}/solicitudes?pagina=${pagina || 1}`),
    empAprobar:     (id) => post(`${ENDPOINTS.empleados}/solicitudes/${id}/aprobar`, {}),
    empRechazar:    (id, b) => post(`${ENDPOINTS.empleados}/solicitudes/${id}/rechazar`, b),   // { motivo }
    empleados:      (f) => get(ENDPOINTS.empleados + '?' + new URLSearchParams(Object.entries(f || {}).filter(([, v]) => v))),   // { estado, pagina }
    empSuspender:   (id, b) => post(`${ENDPOINTS.empleados}/${id}/suspender`, b),                // { motivo, dias }
    empBaja:        (id) => post(`${ENDPOINTS.empleados}/${id}/baja`, {}),
    catalogo:         (cat) => get(`${ENDPOINTS.catalogos}/${cat}`),
    catalogoAgregar:  (cat, b) => post(`${ENDPOINTS.catalogos}/${cat}`, b),                        // { nombre }
    catalogoEditar:   (cat, id, b) => post(`${ENDPOINTS.catalogos}/${cat}/${id}/editar`, b),      // { nombre }
    catalogoEliminar: (cat, id) => post(`${ENDPOINTS.catalogos}/${cat}/${id}/eliminar`, {}),
    usuarios:       (f) => get(ENDPOINTS.usuarios + '?' + new URLSearchParams(Object.entries(f || {}).filter(([, v]) => v))),   // { estado, q, pagina }
    usuBanear:      (id, b) => post(`${ENDPOINTS.usuarios}/${id}/banear`, b),       // { motivo, comentario }
    usuEliminar:    (id, b) => post(`${ENDPOINTS.usuarios}/${id}/eliminar`, b),     // { contrasena }
    usuAlertar:     (id, b) => post(`${ENDPOINTS.usuarios}/${id}/alertar`, b),      // { mensaje }
    denuncias:        (f) => get(ENDPOINTS.denuncias + '?' + new URLSearchParams(Object.entries(f || {}).filter(([, v]) => v))),   // { estado, motivo, pagina }
    denuncia:         (id) => get(`${ENDPOINTS.denuncias}/${id}`),
    denunciaResolver: (id, b) => post(`${ENDPOINTS.denuncias}/${id}/resolver`, b),   // { accion, comentario, contrasena? }
    denunciarUsuario: (b) => post(ENDPOINTS.denuncias, b),                           // { id_reporte, motivo, comentario }
    perfil:                () => get(ENDPOINTS.perfil),
    perfilCorreoSolicitar: (b) => post(`${ENDPOINTS.perfil}/correo/solicitar`, b),   // { correo, contrasena }
    perfilCorreoReenviar:  () => post(`${ENDPOINTS.perfil}/correo/reenviar`, {}),
    perfilCorreoConfirmar: (b) => post(`${ENDPOINTS.perfil}/correo/confirmar`, b),   // { codigo }
    perfilContrasena:      (b) => post(`${ENDPOINTS.perfil}/contrasena`, b),         // { actual, nueva, confirmacion }
    perfilEliminar:        (b) => post(`${ENDPOINTS.perfil}/eliminacion`, b),        // { contrasena }
    perfilEliminarCancelar: () => post(`${ENDPOINTS.perfil}/eliminacion/cancelar`, {}),
    invitarAdmin:   (b) => post(ENDPOINTS.administradores + '/invitar', b),   // { correo, contrasena }
    registerEmployee: (b) => post(ENDPOINTS.registerEmployee, b),   // { nombre, correo, contrasena, acepta_aviso }
    adminInviteCheck: (b) => post(ENDPOINTS.adminInviteCheck, b),   // { token }
    registerAdmin:    (b) => post(ENDPOINTS.registerAdmin, b),      // { token, nombre, contrasena, acepta_aviso }
    recoveryReset:   ({ correo, codigo, nueva_contrasena })       => post(ENDPOINTS.recoveryReset, { correo, codigo, nueva_contrasena }),
  };
})();