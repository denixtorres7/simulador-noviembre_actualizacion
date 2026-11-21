/*
 * Restaura una cotización seleccionada desde Proyecto Creativo,
 * incluso si el usuario abrió Proyecto en una pestaña independiente.
 * Se carga DESPUÉS del script principal de modulos/productos/index.html.
 */
(() => {
  'use strict';
  const PENDING_EDIT_KEY = 'svc-project-edit-pending-v1';
  const QUOTES_KEY = 'svc-design-quotes-v1';
  let requestedId = null;
  try {
    requestedId = sessionStorage.getItem(PENDING_EDIT_KEY);
  } catch {
    return;
  }
  if (!requestedId) return;
  // Consumir la solicitud una vez: no abrir de nuevo la edición en cada carga.
  sessionStorage.removeItem(PENDING_EDIT_KEY);

  let list = [];
  try {
    const data = JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]');
    if (Array.isArray(data)) list = data;
  } catch {}
  const quote = list.find(q => q && q.id === requestedId);
  const status = document.getElementById('saveProductStatus');
  if (!quote || !quote.details) {
    if (status) status.textContent = 'No se encontró un desglose editable para la cotización solicitada.';
    return;
  }
  // Emplea el controlador NATIVO: restaura horas, perfiles, materiales,
  // recursos, nombre y margen. El botón Guardar actualiza el mismo ID.
  window.dispatchEvent(new MessageEvent('message', {
    source: window.parent,
    data: { type: 'svc-edit-design-quote', quote }
  }));
})();
