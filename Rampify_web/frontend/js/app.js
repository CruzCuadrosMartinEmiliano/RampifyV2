/* ===== app.js — sesión, menú por rol y cierre de sesión (RF_19) para todas las pantallas internas ===== */
/* Escapa texto de usuarios antes de insertarlo como HTML (evita XSS) */
Rampify.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

Rampify.ready = (async () => {
  const { CONFIG, api } = Rampify, rolEsperado = document.body.dataset.role;
  const r = await api.me();
  if (!r.ok) { location.href = '../login.html'; return null; }                          // sin sesión → login
  if (r.data.rol !== rolEsperado) { location.href = '../' + (CONFIG.ROLE_ROUTES[r.data.rol] || 'login.html'); return null; }   // rol distinto → su propio inicio
  const u = r.data, actual = document.body.dataset.page;
  document.querySelector('[data-user-name]').textContent = u.nombre;
  document.querySelector('[data-user-role]').textContent = u.rol;
  document.querySelector('[data-nav]').innerHTML = (CONFIG.NAV[u.rol] || []).map(i => i.href
    ? `<a class="nav__item" href="${i.href}"${i.key === actual ? ' aria-current="page"' : ''}>${i.label}</a>`
    : `<span class="nav__item" aria-disabled="true">${i.label}<span class="nav__soon">Pronto</span></span>`).join('');
  /* RF_19: solo se redirige si el servidor confirmó el cierre. Sin red o sin respuesta en 5 s (flujo alterno 1):
     se muestra el mensaje, la sesión sigue activa y el actor puede reintentar. */
  const btnSalir = document.querySelector('[data-action="logout"]');
  btnSalir.addEventListener('click', async () => {
    btnSalir.disabled = true;
    const out = await api.logout();
    if (out.ok) { location.href = '../login.html'; return; }
    btnSalir.disabled = false;
    let aviso = document.querySelector('[data-logout-error]');
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.setAttribute('data-logout-error', ''); aviso.setAttribute('role', 'alert');
      aviso.style.margin = 'var(--sp-4)';
      document.querySelector('.topbar').after(aviso);
    }
    aviso.className = 'alert alert--error'; aviso.textContent = Rampify.MESSAGES.logoutFailed;
  });
  /* RNF-SEG-04: tras 30 min sin actividad se cierra la sesión. La actividad (clic, teclado, mouse, scroll, toque)
     reinicia el reloj y, como máximo cada 5 min, renueva la sesión en el servidor. */
  let temporizador, ultimoPing = Date.now();
  const expirar = async () => { await api.logout(); location.href = '../login.html?expirada=1'; };
  const actividad = () => {
    clearTimeout(temporizador); temporizador = setTimeout(expirar, CONFIG.SESSION_IDLE_MS);
    if (Date.now() - ultimoPing > CONFIG.SESSION_PING_MS) { ultimoPing = Date.now(); api.me(); }
  };
  ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(ev => document.addEventListener(ev, actividad, { passive: true }));
  actividad();
  return u;
})();