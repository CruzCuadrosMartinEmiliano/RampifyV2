/* ===== landing.js — página de inicio pública ===== */
(() => {
  // Enlaces de descarga: se toman de config.js (APP_LINKS). Con null se queda en "Próximamente".
  const links = (window.Rampify && Rampify.CONFIG && Rampify.CONFIG.APP_LINKS) || {};
  document.querySelectorAll('[data-store]').forEach((a) => {
    const url = links[a.dataset.store];
    if (!url) return;
    a.href = url;
    a.removeAttribute('aria-disabled');
    const small = a.querySelector('small');
    if (small) small.textContent = 'Descargar';
  });

  // Año del pie
  document.querySelectorAll('[data-year]').forEach((n) => { n.textContent = new Date().getFullYear(); });

  // Línea bajo la cabecera solo cuando se ha hecho scroll
  const header = document.querySelector('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();