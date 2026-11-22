/* ===== catalogos.js — RF_25 Agregar · RF_26 Editar · RF_27 Eliminar elemento de catálogo (Administrador) ===== */
Rampify.ready.then((user) => {
  if (!user) return;
  const { api, MESSAGES: M, CONFIG: { RULES }, ui, esc } = Rampify, $ = (s) => document.querySelector(s);
  const lista = $('[data-form="lista"]'), fAgregar = $('[data-form="agregar"]'), fEditar = $('[data-form="editar"]'), fEliminar = $('[data-form="eliminar"]');
  const panel = $('[data-detail]'), selCat = $('[data-filter="catalogo"]');
  const limAgregar = Rampify.createRateLimiter(fAgregar), limEditar = Rampify.createRateLimiter(fEditar), limEliminar = Rampify.createRateLimiter(fEliminar);
  const filas = new Map(); let actual = null;
  const busy = (f, on) => f.querySelectorAll('[data-submit]').forEach(b => { if (!on || !f.dataset.locked) b.disabled = on; });
  const errorNombre = (v) => v.length < RULES.CATALOG_NAME_MIN || v.length > RULES.CATALOG_NAME_MAX ? M.catNameRange : '';   // flujo alterno 2
  const cerrar = () => { panel.hidden = true; actual = null; };

  async function cargarLista() {
    const r = await api.catalogo(selCat.value);
    if (!r.ok) return ui.showAlert(lista, 'error', M.catalogError);
    const d = r.data; filas.clear(); d.elementos.forEach(x => filas.set(x.id, x));
    $('[data-list]').innerHTML = d.elementos.map(x => `<tr><td><button class="row-btn" type="button" data-id="${x.id}" aria-current="${!!actual && actual.id === x.id}">
      <span>${esc(x.nombre)}</span></button></td></tr>`).join('');
    $('[data-empty]').hidden = d.elementos.length > 0; $('[data-empty]').textContent = M.noCatItems;
    $('[data-count]').textContent = d.elementos.length ? `${d.elementos.length} elemento(s) activo(s)` : '';
  }
  function abrir(id) {
    actual = filas.get(id); if (!actual) return;
    ui.clearErrors(fEditar); ui.clearErrors(fEliminar); ui.hideAlert(lista); panel.hidden = false;
    document.querySelectorAll('.row-btn').forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.id) === id)));
    $('[data-d="titulo"]').textContent = actual.nombre; fEditar.elements.nombre.value = actual.nombre;
  }
  // El elemento ya no está Activo (otro administrador lo eliminó): se actualiza la lista
  async function noDisponible() { cerrar(); await cargarLista(); ui.showAlert(lista, 'warning', M.itemNotActive); }
  async function resultado(form, r, okMsg) {
    if (r.ok) { cerrar(); await cargarLista(); return ui.showAlert(lista, 'success', okMsg); }
    const c = r.data.code;
    if (c === 'ITEM_EXISTS') return ui.setFieldError(form, 'nombre', M.itemExists);                    // flujo alterno 1: no se guarda
    if (c === 'NAME_RANGE') return ui.setFieldError(form, 'nombre', M.catNameRange);
    if (c === 'NOT_FOUND' || c === 'ITEM_DELETED') return noDisponible();
    ui.showAlert(form, 'error', c === 'NETWORK' ? M.network : M.unknown);
  }

  fAgregar.addEventListener('submit', async (e) => {                                                  // RF_25
    e.preventDefault(); ui.clearErrors(fAgregar); ui.hideAlert(lista);
    const nombre = fAgregar.elements.nombre.value.trim(), err = errorNombre(nombre);
    if (err) return ui.setFieldError(fAgregar, 'nombre', err);
    limAgregar.register(); busy(fAgregar, true);
    const r = await api.catalogoAgregar(selCat.value, { nombre }); busy(fAgregar, false);
    if (r.ok) fAgregar.reset();
    resultado(fAgregar, r, M.itemAdded);
  });
  fEditar.addEventListener('submit', async (e) => {                                                   // RF_26
    e.preventDefault(); ui.clearErrors(fEditar); ui.hideAlert(lista);
    const nombre = fEditar.elements.nombre.value.trim(), err = errorNombre(nombre);
    if (err) return ui.setFieldError(fEditar, 'nombre', err);
    limEditar.register(); busy(fEditar, true);
    const r = await api.catalogoEditar(selCat.value, actual.id, { nombre }); busy(fEditar, false); resultado(fEditar, r, M.itemUpdated);
  });
  fEliminar.addEventListener('submit', async (e) => {                                                 // RF_27
    e.preventDefault(); ui.clearErrors(fEliminar); ui.hideAlert(lista);
    if (!confirm(M.confirmCatDelete)) return;                                                         // flujo alterno 1: se conserva el elemento
    limEliminar.register(); busy(fEliminar, true);
    const r = await api.catalogoEliminar(selCat.value, actual.id); busy(fEliminar, false); resultado(fEliminar, r, M.itemDeleted);
  });
  selCat.addEventListener('change', () => { cerrar(); ui.hideAlert(lista); cargarLista(); });
  document.addEventListener('click', (e) => { const fila = e.target.closest('.row-btn'); if (fila) abrir(Number(fila.dataset.id)); });
  cargarLista();
});