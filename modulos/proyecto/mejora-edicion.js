/*
 * Proyecto Creativo — editar, retirar y recuperar cotizaciones.
 * No modifica la estructura ni las claves existentes del simulador.
 * Una papelera local permite recuperar eliminaciones mientras se conserven
 * los datos del navegador; no sustituye el respaldo JSON general.
 */
(() => {
  'use strict';
  const QUOTES_KEY = 'svc-design-quotes-v1';
  const PROJECT_KEY = 'svc-project-v1';
  const TRASH_KEY = 'svc-design-quotes-trash-v1';
  const PENDING_EDIT_KEY = 'svc-project-edit-pending-v1';
  const host = document.getElementById('quotes');
  if (!host) return;

  const css = document.createElement('style');
  css.textContent = `.svc-quote-actions{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 13px 45px}
    .svc-quote-actions button{padding:6px 12px}
    .svc-quote-message{margin:8px 0;font-weight:600}
    .svc-quote-trash{margin:10px 0;border:1px solid var(--line);border-radius:9px;padding:10px}
    .svc-quote-trash summary{cursor:pointer;font-weight:700}
    .svc-quote-trash-row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:8px;border-bottom:1px solid var(--line)}
    @media(max-width:650px){.svc-quote-actions{margin-left:0}}`;
  document.head.append(css);
  const message = document.createElement('div');
  message.className = 'svc-quote-message';
  message.setAttribute('role','status');
  message.setAttribute('aria-live','polite');
  host.before(message);
  const trashPanel = document.createElement('details');
  trashPanel.className = 'svc-quote-trash';
  host.after(trashPanel);

  function getJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
    catch { return fallback; }
  }
  const getQuotes = () => {const v=getJSON(QUOTES_KEY,[]);return Array.isArray(v)?v:[];};
  const getTrash = () => {const v=getJSON(TRASH_KEY,[]);return Array.isArray(v)?v:[];};
  const visibleQuotes = () => getQuotes().filter(q => q && typeof q.id === 'string' && typeof q.name === 'string' && Number.isFinite(q.price) && q.price>=0);
  function safeSave(key, value) { localStorage.setItem(key,JSON.stringify(value)); }

  function editQuote(id) {
    const quote = getQuotes().find(q => q && q.id === id);
    if (!quote) {message.textContent='No se encontró la cotización. Actualiza la página.';return;}
    if (!quote.details) {message.textContent='Esta cotización antigua no tiene desglose editable; conserva su respaldo JSON antes de rehacerla.';return;}
    if (window.parent !== window) {
      window.parent.postMessage({type:'svc-open-design-quote',quote},'*');
    } else {
      try {
        sessionStorage.setItem(PENDING_EDIT_KEY,id);
        window.location.assign('../../index.html#productos');
      } catch {
        message.textContent='No se pudo abrir la edición. Revisa los permisos del navegador.';
      }
    }
  }

  function removeQuote(id) {
    const existing=getQuotes();
    const index=existing.findIndex(q=>q && q.id===id);
    if(index<0){message.textContent='No se encontró la cotización.';return;}
    const quote=existing[index];
    if (!window.confirm(`¿Retirar «${quote.name}» del proyecto?\n\nQuedará en «Productos eliminados» para poder restaurarlo. Guarda además tu respaldo JSON.`)) return;
    const oldProject=getJSON(PROJECT_KEY,{});
    const oldTrash=getTrash();
    if(!oldProject || typeof oldProject!=='object' || Array.isArray(oldProject)){
      message.textContent='No se puede modificar el proyecto; antes revisa su respaldo.';return;
    }
    const oldSelection=oldProject.selected && Object.prototype.hasOwnProperty.call(oldProject.selected,id) ? oldProject.selected[id] : null;
    const entry={quote,index,selected:oldSelection,deletedAt:new Date().toISOString()};
    const newTrash=[...oldTrash.filter(x=>x && x.quote?.id!==id),entry];
    const newProject={...oldProject,selected:{...(oldProject.selected||{})}};
    delete newProject.selected[id];
    try {
      // Primero conservar el registro íntegro; si falla, no se toca el proyecto.
      safeSave(TRASH_KEY,newTrash);
      safeSave(QUOTES_KEY,existing.filter(q=>!q || q.id!==id));
      safeSave(PROJECT_KEY,newProject);
      window.location.reload();
    }catch{
      // Intentar restituir el estado previo ante un fallo de espacio/permisos.
      try {safeSave(QUOTES_KEY,existing);safeSave(PROJECT_KEY,oldProject);safeSave(TRASH_KEY,oldTrash);}catch{}
      message.textContent='No se pudo terminar la eliminación. Comprueba el almacenamiento y conserva tu respaldo.';
    }
  }

  function restoreQuote(id){
    const trash=getTrash();
    const entry=trash.find(x=>x && x.quote?.id===id);
    if(!entry)return;
    const existing=getQuotes();
    if(existing.some(q=>q && q.id===id)){
      message.textContent='Ese producto ya está en el proyecto. No se sobrescribió.';return;
    }
    const project=getJSON(PROJECT_KEY,{});
    if(!project||typeof project!=='object'||Array.isArray(project))return;
    const updated=existing.slice();
    const index=Math.max(0,Math.min(updated.length,Number(entry.index)||0));
    updated.splice(index,0,entry.quote);
    const newProject={...project,selected:{...(project.selected||{})}};
    if(entry.selected!==null)newProject.selected[id]=entry.selected;
    try{
      // No eliminar de papelera antes de recuperar en la lista activa.
      safeSave(QUOTES_KEY,updated);
      safeSave(PROJECT_KEY,newProject);
      safeSave(TRASH_KEY,trash.filter(x=>x && x.quote?.id!==id));
      window.location.reload();
    }catch{
      // Mantener consistentes el listado, la selección y la papelera si se interrumpe una escritura.
      try {safeSave(QUOTES_KEY,existing);safeSave(PROJECT_KEY,project);safeSave(TRASH_KEY,trash);}catch{}
      message.textContent='No se pudo restaurar el producto. Conserva tu respaldo y revisa el almacenamiento.';
    }
  }

  function renderTrash(){
    const list=getTrash().filter(x=>x && x.quote && typeof x.quote.id==='string');
    trashPanel.replaceChildren();
    const summary=document.createElement('summary');
    summary.textContent=`Productos eliminados recuperables (${list.length})`;
    trashPanel.append(summary);
    if(!list.length){const p=document.createElement('p');p.textContent='No hay productos eliminados.';trashPanel.append(p);return;}
    for(const x of list){
      const row=document.createElement('div');row.className='svc-quote-trash-row';
      const desc=document.createElement('span');desc.textContent=x.quote.name;
      const restore=document.createElement('button');restore.type='button';restore.textContent='Restaurar';
      restore.setAttribute('aria-label',`Restaurar ${x.quote.name}`);
      restore.addEventListener('click',()=>restoreQuote(x.quote.id));
      row.append(desc,restore);trashPanel.append(row);
    }
  }

  function enhanceRows(){
    const visible=visibleQuotes();
    const rows=[...host.querySelectorAll('.calc-project-row')];
    rows.forEach((row,i)=>{
      if(row.dataset.svcEditable==='1')return;
      const quote=visible[i];if(!quote)return;
      row.dataset.svcEditable='1';
      const actions=document.createElement('div');actions.className='svc-quote-actions';
      const edit=document.createElement('button');edit.type='button';edit.textContent='Editar';
      edit.setAttribute('aria-label',`Editar cotización ${quote.name}`);
      edit.addEventListener('click',()=>editQuote(quote.id));
      const remove=document.createElement('button');remove.type='button';remove.textContent='Eliminar';
      remove.setAttribute('aria-label',`Eliminar cotización ${quote.name}`);
      remove.addEventListener('click',()=>removeQuote(quote.id));
      actions.append(edit,remove);row.after(actions);
      const details=actions.nextElementSibling;
      if(details && details.classList.contains('quote-detail')){
        const old=details.querySelector('button');
        if(old)old.onclick=()=>editQuote(quote.id);
      }
    });
  }
  const observer=new MutationObserver(enhanceRows);
  observer.observe(host,{childList:true});
  enhanceRows();renderTrash();
})();
