/* ===== config.js — ÚNICO lugar para URL de API, endpoints y reglas de negocio ===== */
window.Rampify = window.Rampify || {};
Rampify.CONFIG = {
  API_BASE_URL: window.RAMPIFY_API_BASE_URL || '',   // URL pública de Render al publicar
  USE_MOCK: false,                           // ← poner en false cuando exista el backend
  TIMEOUT_MS: 5000,
  SESSION_IDLE_MS: 30 * 60 * 1000,           // RNF-SEG-04: expiración por inactividad (debe coincidir con INACTIVIDAD_MIN del backend)
  SESSION_PING_MS: 5 * 60 * 1000,            // mientras el actor trabaja, renueva la sesión como máximo cada 5 min
  ENDPOINTS: {
    login:            '/api/auth/login',
    recoveryRequest:  '/api/auth/recuperacion/solicitar',
    recoveryVerify:   '/api/auth/recuperacion/verificar',
    recoveryReset:    '/api/auth/recuperacion/restablecer',
    me:               '/api/auth/me',
    logout:           '/api/auth/logout',
    dashboard:        '/api/dashboard',
    solicitudes:      '/api/solicitudes',       // /:id/aprobar · /:id/rechazar
    administradores:  '/api/administradores',   // /invitar
    catalogos:        '/api/catalogos',         // /:catalogo · /:catalogo/:id/editar · /:catalogo/:id/eliminar
    empleados:        '/api/empleados',         // /solicitudes · /solicitudes/:id/aprobar|rechazar · /:id/suspender|baja
    usuarios:         '/api/usuarios',          // /:id/banear · /:id/eliminar · /:id/alertar
    denuncias:        '/api/denuncias',         // POST (reportar usuario) · /:id · /:id/imagen · /:id/resolver
    perfil:           '/api/perfil',            // /correo/solicitar|reenviar|confirmar · /contrasena · /eliminacion · /eliminacion/cancelar
    reportes:         '/api/reportes',          // /:id · /:id/imagen · /:id/estado · /:id/rechazar
    registerEmployee: '/api/registro/empleado',
    adminInviteCheck: '/api/registro/admin/validar',
    registerAdmin:    '/api/registro/admin',
  },
  /* Roles = tabla `rol` de la BD. Solo roles web; el rol 1 pertenece a la app móvil. */
  ROLE_ROUTES: {
    'Empleado de la asociación': 'empleado/inicio.html',
    'Administrador del sistema': 'admin/inicio.html',
  },
  /* Menú lateral por rol. href:null = módulo aún no construido (se muestra como "Pronto"). Rutas relativas a html/<rol>/ */
  NAV: {
    'Empleado de la asociación': [
      { key: 'dashboard', label: 'Dashboard', href: 'inicio.html' },
      { key: 'reportes',  label: 'Reportes', href: 'reportes.html' },   // RF_10, RF_11
      { key: 'cuenta',    label: 'Mi cuenta', href: 'perfil.html' },   // RF_15 a RF_19
    ],
    'Administrador del sistema': [
      { key: 'dashboard',   label: 'Dashboard', href: 'inicio.html' },
      { key: 'reportes',    label: 'Reportes', href: 'reportes.html' },  // RF_10, RF_13
      { key: 'solicitudes', label: 'Solicitudes de eliminación', href: 'solicitudes.html' },// RF_12
      { key: 'sol-empleados', label: 'Solicitudes de empleados', href: 'solicitudes-empleados.html' },   // RF_21
      { key: 'empleados',   label: 'Empleados', href: 'empleados.html' },   // RF_22, RF_23
      { key: 'admins',      label: 'Administradores', href: 'administradores.html' },           // RF_24
      { key: 'catalogos',   label: 'Catálogos', href: 'catalogos.html' },                 // RF_25 a RF_27
      { key: 'moderacion',  label: 'Moderación de usuarios', href: 'moderacion.html' },    // RF_28 a RF_30
      { key: 'denuncias',   label: 'Denuncias de usuarios', href: 'denuncias.html' },      // RF_32
      { key: 'cuenta',    label: 'Mi cuenta', href: 'perfil.html' },   // RF_15 a RF_19
    ],
  },
  /* Descarga de la app móvil. Con null se muestra "Próximamente". */
  APP_LINKS: { android: null, ios: null },
  RULES: {
    SUSPEND_MIN_DAYS: 1, SUSPEND_MAX_DAYS: 365,
    STATE_COMMENT_MAX: 300, BAN_COMMENT_MAX: 300, ALERT_MIN: 10, ALERT_MAX: 300, REPORT_USER_COMMENT_MAX: 300, RESOLVE_COMMENT_MAX: 300, REJECT_MIN: 10, REJECT_MAX: 200,
    NAME_MIN: 2, NAME_MAX: 64, CATALOG_NAME_MIN: 2, CATALOG_NAME_MAX: 60,
    EMAIL_MAX: 254, PASSWORD_MIN: 8, PASSWORD_MAX: 64, CODE_LENGTH: 6,
    RATE_LIMIT: { MAX_REQUESTS: 5, WINDOW_MS: 60000, LOCK_MS: 30000 },  // regla general
  },
};