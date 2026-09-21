// =========================================================================
// MÓDULO 2 - EDITOR DE PLANTILLAS: ORQUESTADOR PRINCIPAL Y PERSISTENCIA
// Archivo: public/js/editor.js
// Responsabilidad: Coordinar visibilidad de pestañas (Tab 1 vs Tab 2),
//                  persistencia global (Cargar, Crear, Eliminar, Guardar),
//                  historial Undo/Redo y puente de dimensiones (Ancho x Alto).
// =========================================================================

// ESTADO GLOBAL COMPARTIDO ENTRE MÓDULOS
var currentTemplate = null;

var FIELD_DEFINITIONS = [
  { id: 'title', label: 'Título (Producto)', defaultVal: 'NOMBRE DEL PRODUCTO MUESTRA' },
  { id: 'spec_1', label: 'Spec 1', defaultVal: 'Características Principales 1' },
  { id: 'spec_2', label: 'Spec 2', defaultVal: 'Detalle o Modelo Spec 2' },
  { id: 'spec_3', label: 'Spec 3', defaultVal: 'Información Adicional Spec 3' },
  { id: 'spec_4', label: 'Spec 4', defaultVal: 'Origen / Fabricación Spec 4' },
  { id: 'spec_5', label: 'Spec 5', defaultVal: 'Notas Secundarias Spec 5' },
  { id: 'moneda', label: 'Moneda', defaultVal: '$' },
  { id: 'publico_entero', label: 'PUBLICO Entero', defaultVal: '999' },
  { id: 'publico_decimal', label: 'PUBLICO Decimal', defaultVal: '00' },
  { id: 'cod_1', label: 'COD 1', defaultVal: 'COD-12345' },
  { id: 'cod_2', label: 'COD 2', defaultVal: 'PN-98765' },
  { id: 'distribuidor', label: 'DISTRIBUIDOR', defaultVal: '750.00' }
];

var SYSTEM_FONTS = ['Montserrat', 'Roboto', 'Oswald', 'Roboto Mono', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS', 'Impact'];

var historyUndo = [];
var historyRedo = [];
var selectedElementId = null;
var allEditorProducts = [];
var selectedTestProduct = null;
var customInstalledFonts = [];
var currentZoom = 1.0;

var activeEditorTab = 1;

// INICIALIZACIÓN DEL MÓDULO EDITOR
async function initEditorModule() {
  initSplitters();

  if (typeof loadInstalledFonts === 'function') {
    await loadInstalledFonts();
  }
  if (typeof loadEditorProductsTable === 'function') {
    await loadEditorProductsTable();
  }

  await loadTemplateSelectOptions();

  // Si proviene del botón "Editar Plantilla" del Generador
  const editTplId = localStorage.getItem('edit_template_id');
  if (editTplId) {
    localStorage.removeItem('edit_template_id');
    await loadTemplateById(editTplId);
  } else {
    // Reflejar la plantilla activa en el selector
    const select = document.getElementById('editor-template-select') || document.getElementById('tpl-selector');
    if (select && currentTemplate && currentTemplate.id) {
      select.value = String(currentTemplate.id);
      syncUIWithTemplate();
    } else {
      setEditorEmptyState();
    }
  }

  // Restaurar la pestaña en la que estaba trabajando el usuario (1 = Diseño Visual, 2 = Estructura A4)
  switchEditorTab(activeEditorTab || 1);

  if (typeof resetTab1Zoom === 'function') {
    resetTab1Zoom();
  }

  window.removeEventListener('keydown', handleEditorKeyDown);
  window.addEventListener('keydown', handleEditorKeyDown);
  window.onresize = () => {
    if (typeof initTab1BaseSize === 'function') initTab1BaseSize();
    if (typeof renderMatrizA4Tab1 === 'function') renderMatrizA4Tab1();
    if (typeof renderCanvas === 'function') renderCanvas();
  };
}

// GESTIÓN DE ESTADO VACÍO (CUANDO NO HAY PLANTILLA SELECCIONADA)
function setEditorEmptyState() {
  currentTemplate = null;
  selectedElementId = null;
  historyUndo = [];
  historyRedo = [];
  updateUndoRedoButtons();

  const overlay = document.getElementById('editor-empty-state');
  if (overlay) overlay.classList.remove('hidden');

  const nameInput = document.getElementById('tpl-nombre');
  if (nameInput) {
    nameInput.value = '';
    nameInput.placeholder = '(Sin plantilla seleccionada)';
    nameInput.disabled = true;
    nameInput.classList.add('opacity-50', 'cursor-not-allowed');
  }

  const select = document.getElementById('editor-template-select') || document.getElementById('tpl-selector');
  if (select) select.value = '';

  const btnDel = document.getElementById('btn-delete-tpl');
  if (btnDel) {
    btnDel.disabled = true;
    btnDel.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
  }

  const btnSave = document.getElementById('btn-save-tpl');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
  }

  const badge = document.getElementById('canvas-dimension-badge');
  if (badge) badge.textContent = '-- x --';

  // Limpiar capas visuales interactivas y pliego A4
  const elementsLayer = document.getElementById('canvas-elements-layer');
  if (elementsLayer) elementsLayer.innerHTML = '';

  const canvas = document.getElementById('editor-canvas');
  if (canvas) {
    canvas.style.backgroundImage = 'none';
  }

  const sheet = document.getElementById('tab1-a4-preview-sheet');
  if (sheet) sheet.innerHTML = '';

  const dynamicAccordions = document.getElementById('dynamic-property-accordions');
  if (dynamicAccordions) dynamicAccordions.innerHTML = '';

  const switchesContainer = document.getElementById('props-switches-container');
  if (switchesContainer) switchesContainer.innerHTML = '';
}

function exitEditorEmptyState() {
  const overlay = document.getElementById('editor-empty-state');
  if (overlay) overlay.classList.add('hidden');

  const nameInput = document.getElementById('tpl-nombre');
  if (nameInput) {
    nameInput.disabled = false;
    nameInput.placeholder = 'Nombre de plantilla (ej: Oferta 10.0x5.0)';
    nameInput.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  const btnDel = document.getElementById('btn-delete-tpl');
  if (btnDel) {
    btnDel.disabled = false;
    btnDel.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
  }

  const btnSave = document.getElementById('btn-save-tpl');
  if (btnSave) {
    btnSave.disabled = false;
    btnSave.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
  }
}

// CONTROL DE HISTORIAL (UNDO / REDO - EXCLUSIVO DE DISEÑO VISUAL)
function pushHistoryState() {
  if (!currentTemplate) return;
  const disenoContainer = document.getElementById('editor-tab-1-container');
  if (disenoContainer && disenoContainer.classList.contains('hidden')) return;

  const snapshot = JSON.stringify(currentTemplate);
  if (historyUndo.length === 0 || historyUndo[historyUndo.length - 1] !== snapshot) {
    historyUndo.push(snapshot);
    if (historyUndo.length > 30) historyUndo.shift();
    historyRedo = [];
    updateUndoRedoButtons();
  }
}

function undoAction() {
  if (!currentTemplate) return;
  const disenoContainer = document.getElementById('editor-tab-1-container');
  if (disenoContainer && disenoContainer.classList.contains('hidden')) return;

  if (historyUndo.length === 0) return;
  const currentSnapshot = JSON.stringify(currentTemplate);
  historyRedo.push(currentSnapshot);
  const prevState = JSON.parse(historyUndo.pop());
  currentTemplate = prevState;

  syncUIWithTemplate();
  updateUndoRedoButtons();
}

function redoAction() {
  if (!currentTemplate) return;
  const disenoContainer = document.getElementById('editor-tab-1-container');
  if (disenoContainer && disenoContainer.classList.contains('hidden')) return;

  if (historyRedo.length === 0) return;
  const currentSnapshot = JSON.stringify(currentTemplate);
  historyUndo.push(currentSnapshot);
  const nextState = JSON.parse(historyRedo.pop());
  currentTemplate = nextState;

  syncUIWithTemplate();
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  if (btnUndo) btnUndo.disabled = !currentTemplate || historyUndo.length === 0;
  if (btnRedo) btnRedo.disabled = !currentTemplate || historyRedo.length === 0;
}

// NORMALIZACIÓN DEFENSIVA: garantiza que currentTemplate siempre tenga
// las propiedades correctas independientemente de lo que devuelva la API.
function _normalizarPlantilla(tpl) {
  if (!tpl || typeof tpl !== 'object') return null;
  // 1. ID siempre numérico o null
  tpl.id = tpl.id != null ? Number(tpl.id) || null : null;

  // 2. campos_habilitados siempre Array
  if (!Array.isArray(tpl.campos_habilitados)) {
    // Si es string JSON, intentar parsear
    if (typeof tpl.campos_habilitados === 'string') {
      try { tpl.campos_habilitados = JSON.parse(tpl.campos_habilitados); } catch (_) {}
    }
    if (!Array.isArray(tpl.campos_habilitados)) {
      tpl.campos_habilitados = ['title', 'spec_1', 'moneda', 'publico_entero', 'publico_decimal', 'cod_1'];
    }
  }

  // 3. elementos siempre objeto con todas las claves de FIELD_DEFINITIONS
  if (!tpl.elementos || typeof tpl.elementos !== 'object' || Array.isArray(tpl.elementos)) {
    if (typeof tpl.elementos === 'string') {
      try { tpl.elementos = JSON.parse(tpl.elementos); } catch (_) {}
    }
    if (!tpl.elementos || typeof tpl.elementos !== 'object') {
      tpl.elementos = {};
    }
  }
  var defaultsElem = {
    title:           { x: 5,  y: 10, fuente: 'Montserrat',  tamano: 22, color: '#1e293b', bold: true,  italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    spec_1:          { x: 5,  y: 35, fuente: 'Roboto',       tamano: 14, color: '#475569', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    spec_2:          { x: 5,  y: 48, fuente: 'Roboto',       tamano: 12, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    spec_3:          { x: 5,  y: 60, fuente: 'Roboto',       tamano: 12, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    spec_4:          { x: 5,  y: 70, fuente: 'Roboto',       tamano: 11, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    spec_5:          { x: 5,  y: 80, fuente: 'Roboto',       tamano: 11, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    moneda:          { x: 62, y: 48, fuente: 'Montserrat',   tamano: 18, color: '#0f172a', bold: true,  italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    publico_entero:  { x: 70, y: 40, fuente: 'Oswald',       tamano: 44, color: '#0f172a', bold: true,  italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    publico_decimal: { x: 90, y: 42, fuente: 'Oswald',       tamano: 22, color: '#0f172a', bold: true,  italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    cod_1:           { x: 5,  y: 85, fuente: 'Roboto Mono',  tamano: 11, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    cod_2:           { x: 40, y: 85, fuente: 'Roboto Mono',  tamano: 11, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
    distribuidor:    { x: 70, y: 85, fuente: 'Roboto',        tamano: 12, color: '#475569', bold: true,  italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 }
  };
  FIELD_DEFINITIONS.forEach(function(f) {
    if (!tpl.elementos[f.id] || typeof tpl.elementos[f.id] !== 'object') {
      tpl.elementos[f.id] = defaultsElem[f.id] || { x: 5, y: 10, fuente: 'Roboto', tamano: 14, color: '#1e293b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 };
    }
  });

  // 4. matriz_a4 siempre objeto válido
  if (!tpl.matriz_a4 || typeof tpl.matriz_a4 !== 'object' || Array.isArray(tpl.matriz_a4)) {
    if (typeof tpl.matriz_a4 === 'string') {
      try { tpl.matriz_a4 = JSON.parse(tpl.matriz_a4); } catch (_) {}
    }
    if (!tpl.matriz_a4 || typeof tpl.matriz_a4 !== 'object') {
      tpl.matriz_a4 = {};
    }
  }
  var m = tpl.matriz_a4;
  if (m.columnas  == null) m.columnas   = 2;
  if (m.filas     == null) m.filas      = 4;
  if (m.margin_top  == null) m.margin_top  = 1.0;
  if (m.margin_left == null) m.margin_left = 1.0;
  if (m.gap_x     == null) m.gap_x      = 0.5;
  if (m.gap_y     == null) m.gap_y      = 0.5;
  if (m.corte_tipo    == null) m.corte_tipo    = 'solid';
  if (m.corte_grosor  == null) m.corte_grosor  = 1;
  if (m.corte_color   == null) m.corte_color   = '#94a3b8';
  if (m.corte_h_activo == null) m.corte_h_activo = true;
  if (m.corte_h_modo  == null) m.corte_h_modo  = 'pegadas';
  if (m.corte_v_activo == null) m.corte_v_activo = true;
  if (m.corte_v_modo  == null) m.corte_v_modo  = 'pegadas';

  // 5. slots_fondo siempre array de 3 slots
  if (!Array.isArray(tpl.slots_fondo) || tpl.slots_fondo.length < 3) {
    tpl.slots_fondo = [
      { id: 0, url: '', nombre: '' },
      { id: 1, url: '', nombre: '' },
      { id: 2, url: '', nombre: '' }
    ];
  }
  if (tpl.slot_activo == null) tpl.slot_activo = 0;

  return tpl;
}

// SINCRONIZAR TODA LA INTERFAZ TRAS CARGAR O REVERTIR PLANTILLA
function syncUIWithTemplate() {
  if (!currentTemplate) {
    setEditorEmptyState();
    return;
  }
  exitEditorEmptyState();

  // Normalizar siempre antes de acceder a cualquier propiedad
  _normalizarPlantilla(currentTemplate);

  if (currentTemplate.ancho > 30) currentTemplate.ancho = parseFloat((currentTemplate.ancho / 10).toFixed(1));
  if (currentTemplate.alto  > 30) currentTemplate.alto  = parseFloat((currentTemplate.alto  / 10).toFixed(1));

  const nameInput = document.getElementById('tpl-nombre');
  if (nameInput) nameInput.value = currentTemplate.nombre || '';

  const anchoInput = document.getElementById('tpl-ancho');
  if (anchoInput) anchoInput.value = (currentTemplate.ancho || 10.0).toFixed(1);

  const altoInput = document.getElementById('tpl-alto');
  if (altoInput) altoInput.value = (currentTemplate.alto || 5.0).toFixed(1);

  const m = currentTemplate.matriz_a4;
  if (m.margin_top  > 5) m.margin_top  = parseFloat((m.margin_top  / 10).toFixed(1));
  if (m.margin_left > 5) m.margin_left = parseFloat((m.margin_left / 10).toFixed(1));
  if (m.gap_x > 3)       m.gap_x       = parseFloat((m.gap_x       / 10).toFixed(1));
  if (m.gap_y > 3)       m.gap_y       = parseFloat((m.gap_y       / 10).toFixed(1));

  if (document.getElementById('tpl-matriz-cols'))        document.getElementById('tpl-matriz-cols').value        = m.columnas || 2;
  if (document.getElementById('tpl-matriz-rows'))        document.getElementById('tpl-matriz-rows').value        = m.filas    || 4;
  if (document.getElementById('tpl-matriz-margin-top'))  document.getElementById('tpl-matriz-margin-top').value  = (m.margin_top  ?? 1.0).toFixed(1);
  if (document.getElementById('tpl-matriz-margin-left')) document.getElementById('tpl-matriz-margin-left').value = (m.margin_left ?? 1.0).toFixed(1);
  if (document.getElementById('tpl-matriz-gap-x'))       document.getElementById('tpl-matriz-gap-x').value       = (m.gap_x ?? 0.5).toFixed(1);
  if (document.getElementById('tpl-matriz-gap-y'))       document.getElementById('tpl-matriz-gap-y').value       = (m.gap_y ?? 0.5).toFixed(1);

  if (document.getElementById('tpl-matriz-corte-tipo'))    document.getElementById('tpl-matriz-corte-tipo').value    = m.corte_tipo   || 'solid';
  if (document.getElementById('tpl-matriz-corte-grosor'))  document.getElementById('tpl-matriz-corte-grosor').value  = m.corte_grosor || 1;
  const colorVal = (m.corte_color && /^#[0-9a-fA-F]{6}$/.test(m.corte_color)) ? m.corte_color : '#94a3b8';
  if (document.getElementById('tpl-matriz-corte-color'))   document.getElementById('tpl-matriz-corte-color').value   = colorVal;

  if (document.getElementById('tpl-matriz-corte-h-activo')) document.getElementById('tpl-matriz-corte-h-activo').checked = m.corte_h_activo !== false;
  if (document.getElementById('tpl-matriz-corte-h-modo'))   document.getElementById('tpl-matriz-corte-h-modo').value   = m.corte_h_modo  || 'pegadas';

  if (document.getElementById('tpl-matriz-corte-v-activo')) document.getElementById('tpl-matriz-corte-v-activo').checked = m.corte_v_activo !== false;
  if (document.getElementById('tpl-matriz-corte-v-modo'))   document.getElementById('tpl-matriz-corte-v-modo').value   = m.corte_v_modo  || 'pegadas';

  if (typeof renderPropertySwitches      === 'function') renderPropertySwitches();
  if (typeof renderAllAccordionSections  === 'function') renderAllAccordionSections();
  if (typeof updateBgSlotsUI             === 'function') updateBgSlotsUI();
  if (typeof renderCanvas                === 'function') renderCanvas();
  if (typeof renderMatrizA4Tab1          === 'function') renderMatrizA4Tab1();
  if (typeof populateEditorTamanoSelect === 'function') populateEditorTamanoSelect();
  if (typeof filterEditorProductsTable   === 'function') filterEditorProductsTable();
}

// NAVEGACIÓN Y ALTERNANCIA DE PESTAÑAS (TAB 1: DISEÑO VISUAL VS TAB 2: ESTRUCTURA A4)
function switchEditorTab(tabNumber) {
  activeEditorTab = Number(tabNumber) || 1;

  const btnTab1 = document.getElementById('tab-btn-1') || document.getElementById('btn-editor-tab-1');
  const btnTab2 = document.getElementById('tab-btn-2') || document.getElementById('btn-editor-tab-2');
  const containerTab1 = document.getElementById('editor-tab-1-container'); // Diseño Visual
  const containerTab2 = document.getElementById('editor-tab-2-container'); // Estructura A4

  if (!containerTab1 || !containerTab2) return;

  const activeTabClass = 'px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer bg-blue-600 text-white shadow-md flex items-center gap-2';
  const inactiveTabClass = 'px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 flex items-center gap-2';

  if (activeEditorTab === 1) {
    // Activar Pestaña 1: Diseño Visual
    if (btnTab1) btnTab1.className = activeTabClass;
    if (btnTab2) btnTab2.className = inactiveTabClass;
    
    containerTab1.classList.remove('hidden');
    containerTab2.classList.add('hidden');

    if (typeof renderPropertySwitches === 'function') renderPropertySwitches();
    if (typeof renderAllAccordionSections === 'function') renderAllAccordionSections();
    if (typeof renderCanvas === 'function') renderCanvas();
    if (typeof populateEditorTamanoSelect === 'function') populateEditorTamanoSelect();
    if (typeof filterEditorProductsTable === 'function') filterEditorProductsTable();
    updateUndoRedoButtons();
  } else {
    // Activar Pestaña 2: Estructura A4
    if (btnTab2) btnTab2.className = activeTabClass;
    if (btnTab1) btnTab1.className = inactiveTabClass;

    containerTab2.classList.remove('hidden');
    containerTab1.classList.add('hidden');

    if (typeof initTab1BaseSize === 'function') initTab1BaseSize();
    if (typeof renderMatrizA4Tab1 === 'function') renderMatrizA4Tab1();
  }
}

// CONTROL POR TECLADO (EXCLUSIVO DE DISEÑO VISUAL)
function handleEditorKeyDown(e) {
  const disenoContainer = document.getElementById('editor-tab-1-container');
  const isDisenoActive = disenoContainer && !disenoContainer.classList.contains('hidden');

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    if (!isDisenoActive) return;
    e.preventDefault();
    undoAction();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    if (!isDisenoActive) return;
    e.preventDefault();
    redoAction();
  } else if (selectedElementId && currentTemplate.elementos[selectedElementId]) {
    if (!isDisenoActive) return;
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') return;

    const elem = currentTemplate.elementos[selectedElementId];
    const step = e.shiftKey ? 1.0 : 0.1;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        pushHistoryState();
        elem.x = Math.max(0, parseFloat((elem.x - step).toFixed(1)));
        if (typeof renderCanvas === 'function') renderCanvas();
        break;
      case 'ArrowRight':
        e.preventDefault();
        pushHistoryState();
        elem.x = Math.min(98, parseFloat((elem.x + step).toFixed(1)));
        if (typeof renderCanvas === 'function') renderCanvas();
        break;
      case 'ArrowUp':
        e.preventDefault();
        pushHistoryState();
        elem.y = Math.max(0, parseFloat((elem.y - step).toFixed(1)));
        if (typeof renderCanvas === 'function') renderCanvas();
        break;
      case 'ArrowDown':
        e.preventDefault();
        pushHistoryState();
        elem.y = Math.min(98, parseFloat((elem.y + step).toFixed(1)));
        if (typeof renderCanvas === 'function') renderCanvas();
        break;
      case 'Escape':
        selectedElementId = null;
        if (typeof renderCanvas === 'function') renderCanvas();
        break;
    }
  }
}

// SPLITTERS / RESIZERS AJUSTABLES
function initSplitters() {
  const hResizer = document.getElementById('editor-h-resizer');
  const leftPanel = document.getElementById('editor-left-panel');
  
  if (hResizer && leftPanel) {
    let isDraggingH = false;

    hResizer.addEventListener('pointerdown', (e) => {
      isDraggingH = true;
      document.body.style.cursor = 'col-resize';
      hResizer.classList.add('bg-blue-500');
    });

    document.addEventListener('pointermove', (e) => {
      if (!isDraggingH) return;
      const containerRect = document.getElementById('editor-main-container').getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      if (newWidth >= 300 && newWidth <= 650) {
        leftPanel.style.width = `${newWidth}px`;
      }
    });

    document.addEventListener('pointerup', () => {
      if (isDraggingH) {
        isDraggingH = false;
        document.body.style.cursor = 'default';
        hResizer.classList.remove('bg-blue-500');
      }
    });
  }
}

var cachedTemplatesList = [];
var currentNewTemplateMode = 'base';

// PERSISTENCIA Y GESTIÓN DE PLANTILLAS (API CRUD)
async function loadTemplateSelectOptions() {
  const select = document.getElementById('editor-template-select') || document.getElementById('tpl-selector');
  if (!select) return;

  try {
    const res = await fetch('/api/templates');
    if (!res.ok) return;
    const templates = await res.json();
    cachedTemplatesList = templates;
    templates.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base', numeric: true }));

    select.innerHTML = '<option value="">-- Cargar Plantilla --</option>';
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.nombre} (${t.ancho}x${t.alto}cm)`;
      if (currentTemplate && currentTemplate.id && Number(t.id) === Number(currentTemplate.id)) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error cargando plantillas:', err);
  }
}

async function loadTemplateById(id) {
  if (!id) return;
  try {
    const res = await fetch(`/api/templates/${id}`);
    if (!res.ok) throw new Error('No se pudo cargar la plantilla');
    const data = await res.json();

    // Normalizar antes de asignar — garantiza integridad del objeto
    currentTemplate = _normalizarPlantilla(data);

    // Asegurar que el selector del desplegable refleje la plantilla activa
    const select = document.getElementById('editor-template-select') || document.getElementById('tpl-selector');
    if (select && currentTemplate.id) {
      select.value = String(currentTemplate.id);
    }

    historyUndo = [];
    historyRedo = [];
    updateUndoRedoButtons();
    syncUIWithTemplate();
  } catch (err) {
    alert('Error al cargar plantilla: ' + err.message);
  }
}

function handleTemplateSelectChange(id) {
  if (!id) {
    setEditorEmptyState();
    return;
  }
  loadTemplateById(id);
}

function loadTemplateForEdit(id) {
  if (!id) {
    setEditorEmptyState();
    return;
  }
  loadTemplateById(id);
}

function getBaseTemplateConfig(nombre = '') {
  return _normalizarPlantilla({
    id: null,
    nombre: nombre || `Plantilla Base ${Date.now().toString().slice(-4)}`,
    ancho: 5.0,
    alto: 5.0,
    etiqueta_tamano: 'Personalizado',
    orientacion: 'horizontal',
    slots_fondo: [
      { id: 0, url: '', nombre: '' },
      { id: 1, url: '', nombre: '' },
      { id: 2, url: '', nombre: '' }
    ],
    slot_activo: 0,
    campos_habilitados: ['title', 'moneda', 'publico_entero', 'publico_decimal', 'cod_2'],
    elementos: {
      title:           { x: 5,  y: 8,  fuente: 'Montserrat',  tamano: 16, color: '#1e293b', bold: true,  italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      spec_1:          { x: 5,  y: 35, fuente: 'Roboto',       tamano: 12, color: '#475569', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      spec_2:          { x: 5,  y: 48, fuente: 'Roboto',       tamano: 11, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      spec_3:          { x: 5,  y: 60, fuente: 'Roboto',       tamano: 11, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      spec_4:          { x: 5,  y: 70, fuente: 'Roboto',       tamano: 10, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      spec_5:          { x: 5,  y: 80, fuente: 'Roboto',       tamano: 10, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      moneda:          { x: 18, y: 44, fuente: 'Montserrat',   tamano: 16, color: '#0f172a', bold: true,  italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      publico_entero:  { x: 30, y: 36, fuente: 'Oswald',       tamano: 36, color: '#0f172a', bold: true,  italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      publico_decimal: { x: 68, y: 38, fuente: 'Oswald',       tamano: 18, color: '#0f172a', bold: true,  italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      cod_1:           { x: 5,  y: 82, fuente: 'Roboto Mono',  tamano: 10, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      cod_2:           { x: 5,  y: 82, fuente: 'Roboto Mono',  tamano: 10, color: '#64748b', bold: false, italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 },
      distribuidor:    { x: 50, y: 82, fuente: 'Roboto',        tamano: 11, color: '#475569', bold: true,  italic: false, alineacion: 'left', espaciado: 0, stroke_activo: false, stroke_color: '#000000', stroke_width: 1.0 }
    },
    matriz_a4: {
      columnas: 1, filas: 1,
      margin_top: 1.0, margin_left: 1.0,
      gap_x: 0.0,  gap_y: 0.0,
      corte_tipo: 'solid', corte_grosor: 1, corte_color: '#94a3b8',
      corte_h_activo: false, corte_h_modo: 'pegadas',
      corte_v_activo: false, corte_v_modo: 'pegadas'
    }
  });
}

// GESTIÓN DEL MODAL DE CREACIÓN / DUPLICACIÓN DE PLANTILLA
async function openNewTemplateModal() {
  try {
    const res = await fetch('/api/templates');
    if (res.ok) cachedTemplatesList = await res.json();
  } catch (_) {}

  const hasActiveTemplate = currentTemplate && currentTemplate.id != null && Number(currentTemplate.id) > 0;
  const btnDup = document.getElementById('btn-mode-duplicate');
  if (btnDup) {
    if (hasActiveTemplate) {
      btnDup.disabled = false;
      btnDup.className = 'p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500';
      btnDup.title = `Duplicar plantilla activa: "${currentTemplate.nombre}"`;
    } else {
      btnDup.disabled = true;
      btnDup.className = 'p-3 rounded-xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5 bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-40';
      btnDup.title = 'Selecciona primero una plantilla para duplicarla';
    }
  }

  selectNewTemplateMode('base');

  const modal = document.getElementById('modal-new-template');
  if (modal) modal.classList.remove('hidden');

  setTimeout(() => {
    const input = document.getElementById('modal-tpl-nombre');
    if (input) {
      input.focus();
      input.select();
    }
  }, 60);
}

function closeNewTemplateModal() {
  const modal = document.getElementById('modal-new-template');
  if (modal) modal.classList.add('hidden');
}

function selectNewTemplateMode(mode) {
  const hasActiveTemplate = currentTemplate && currentTemplate.id != null && Number(currentTemplate.id) > 0;
  if (mode === 'duplicate' && !hasActiveTemplate) return;

  currentNewTemplateMode = mode;
  const btnBase = document.getElementById('btn-mode-base');
  const btnDup = document.getElementById('btn-mode-duplicate');
  const input = document.getElementById('modal-tpl-nombre');

  if (mode === 'base') {
    if (btnBase) btnBase.className = 'p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 bg-blue-600/20 border-blue-500 text-white shadow-md';
    if (btnDup && hasActiveTemplate) {
      btnDup.className = 'p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500';
    }
    if (input) {
      input.placeholder = 'Ej: Oferta 5.0x5.0';
      input.value = '';
    }
  } else {
    if (btnDup) btnDup.className = 'p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 bg-purple-600/20 border-purple-500 text-white shadow-md';
    if (btnBase) btnBase.className = 'p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500';

    const baseName = (currentTemplate && currentTemplate.nombre) ? currentTemplate.nombre.trim() : 'Plantilla';
    let candidate = `${baseName} - Copia`;
    let counter = 2;
    const existingNames = cachedTemplatesList.map(t => (t.nombre || '').trim().toLowerCase());
    while (existingNames.includes(candidate.toLowerCase())) {
      candidate = `${baseName} - Copia ${counter}`;
      counter++;
    }
    if (input) {
      input.value = candidate;
    }
  }

  validateNewTemplateName();
}

function validateNewTemplateName() {
  const input = document.getElementById('modal-tpl-nombre');
  const feedback = document.getElementById('modal-tpl-feedback');
  const btnSubmit = document.getElementById('btn-submit-new-tpl');
  if (!input || !feedback || !btnSubmit) return;

  const val = input.value.trim();
  if (!val) {
    feedback.textContent = 'El nombre de la plantilla es obligatorio.';
    feedback.className = 'text-xs text-amber-400 min-h-[18px]';
    input.className = 'w-full bg-slate-900 border border-amber-500/60 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition';
    btnSubmit.disabled = true;
    return;
  }

  const exists = cachedTemplatesList.some(t => (t.nombre || '').trim().toLowerCase() === val.toLowerCase());
  if (exists) {
    feedback.textContent = '⚠️ Ya existe una plantilla con este nombre. Por favor, elige otro.';
    feedback.className = 'text-xs text-red-400 font-medium min-h-[18px]';
    input.className = 'w-full bg-slate-900 border border-red-500 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition';
    btnSubmit.disabled = true;
    return;
  }

  feedback.textContent = '✓ Nombre disponible';
  feedback.className = 'text-xs text-emerald-400 font-medium min-h-[18px]';
  input.className = 'w-full bg-slate-900 border border-emerald-500/60 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition';
  btnSubmit.disabled = false;
}

function confirmCreateNewTemplate() {
  const input = document.getElementById('modal-tpl-nombre');
  if (!input) return;
  const name = input.value.trim();
  if (!name) {
    alert('Ingresa un nombre para la plantilla.');
    return;
  }

  const exists = cachedTemplatesList.some(t => (t.nombre || '').trim().toLowerCase() === name.toLowerCase());
  if (exists) {
    alert(`⚠️ Ya existe una plantilla con el nombre "${name}". Por favor, elige un nombre diferente.`);
    return;
  }

  pushHistoryState();

  if (currentNewTemplateMode === 'duplicate' && currentTemplate && currentTemplate.id != null) {
    const clone = JSON.parse(JSON.stringify(currentTemplate));
    clone.id = null;
    clone.nombre = name;
    currentTemplate = _normalizarPlantilla(clone);
  } else {
    currentTemplate = getBaseTemplateConfig(name);
  }

  historyUndo = [];
  historyRedo = [];
  updateUndoRedoButtons();

  closeNewTemplateModal();
  syncUIWithTemplate();
  switchEditorTab(1);

  const select = document.getElementById('editor-template-select') || document.getElementById('tpl-selector');
  if (select) select.value = '';
}

function createNewTemplate() {
  openNewTemplateModal();
}

async function confirmDeleteTemplate() {
  await deleteCurrentTemplate();
}

async function deleteCurrentTemplate() {
  if (!currentTemplate || !currentTemplate.id) {
    setEditorEmptyState();
    return;
  }

  const confirmed = await showConfirm({
    title: 'Eliminar Plantilla',
    message: `¿Estás seguro de eliminar la plantilla "${currentTemplate.nombre}"?\nEsta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/templates/${currentTemplate.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al eliminar plantilla');

    alert('✅ Plantilla eliminada con éxito.');
    currentTemplate = null;
    await loadTemplateSelectOptions();
    setEditorEmptyState();
  } catch (err) {
    alert(err.message);
  }
}

// Sincronizar todos los campos y parámetros geométricos del DOM hacia currentTemplate
function syncTemplateFromUI() {
  if (!currentTemplate) return;

  const nombreInput = document.getElementById('tpl-nombre');
  if (nombreInput && nombreInput.value.trim()) {
    currentTemplate.nombre = nombreInput.value.trim();
  }

  const anchoInput = document.getElementById('tpl-ancho');
  if (anchoInput) {
    let ancho = parseFloat(anchoInput.value) || 10.0;
    if (ancho > 30) ancho /= 10;
    currentTemplate.ancho = parseFloat(ancho.toFixed(1));
  }

  const altoInput = document.getElementById('tpl-alto');
  if (altoInput) {
    let alto = parseFloat(altoInput.value) || 5.0;
    if (alto > 30) alto /= 10;
    currentTemplate.alto = parseFloat(alto.toFixed(1));
  }

  if (!currentTemplate.matriz_a4 || typeof currentTemplate.matriz_a4 !== 'object') {
    currentTemplate.matriz_a4 = {};
  }
  const m = currentTemplate.matriz_a4;

  const elCols = document.getElementById('tpl-matriz-cols');
  if (elCols && elCols.value !== '') m.columnas = parseInt(elCols.value, 10) || m.columnas || 2;

  const elRows = document.getElementById('tpl-matriz-rows');
  if (elRows && elRows.value !== '') m.filas = parseInt(elRows.value, 10) || m.filas || 4;

  const elMTop = document.getElementById('tpl-matriz-margin-top');
  if (elMTop && elMTop.value !== '') {
    let raw = parseFloat(String(elMTop.value).replace(',', '.'));
    let v = isNaN(raw) ? (m.margin_top ?? 1.0) : raw;
    if (v > 5) v /= 10;
    m.margin_top = parseFloat(v.toFixed(1));
  }

  const elMLeft = document.getElementById('tpl-matriz-margin-left');
  if (elMLeft && elMLeft.value !== '') {
    let raw = parseFloat(String(elMLeft.value).replace(',', '.'));
    let v = isNaN(raw) ? (m.margin_left ?? 1.0) : raw;
    if (v > 5) v /= 10;
    m.margin_left = parseFloat(v.toFixed(1));
  }

  const elGapX = document.getElementById('tpl-matriz-gap-x');
  if (elGapX && elGapX.value !== '') {
    let raw = parseFloat(String(elGapX.value).replace(',', '.'));
    let v = isNaN(raw) ? (m.gap_x ?? 0.0) : raw;
    if (v > 3) v /= 10;
    m.gap_x = parseFloat(v.toFixed(1));
  }

  const elGapY = document.getElementById('tpl-matriz-gap-y');
  if (elGapY && elGapY.value !== '') {
    let raw = parseFloat(String(elGapY.value).replace(',', '.'));
    let v = isNaN(raw) ? (m.gap_y ?? 0.0) : raw;
    if (v > 3) v /= 10;
    m.gap_y = parseFloat(v.toFixed(1));
  }

  const elCorteTipo = document.getElementById('tpl-matriz-corte-tipo');
  if (elCorteTipo) m.corte_tipo = elCorteTipo.value || m.corte_tipo || 'solid';

  const elCorteGrosor = document.getElementById('tpl-matriz-corte-grosor');
  if (elCorteGrosor && elCorteGrosor.value !== '') m.corte_grosor = parseInt(elCorteGrosor.value, 10) || m.corte_grosor || 1;

  const elCorteColor = document.getElementById('tpl-matriz-corte-color');
  if (elCorteColor && elCorteColor.value) m.corte_color = elCorteColor.value;

  const elCorteHActivo = document.getElementById('tpl-matriz-corte-h-activo');
  if (elCorteHActivo) m.corte_h_activo = elCorteHActivo.checked;

  const elCorteHModo = document.getElementById('tpl-matriz-corte-h-modo');
  if (elCorteHModo) m.corte_h_modo = elCorteHModo.value || m.corte_h_modo || 'pegadas';

  const elCorteVActivo = document.getElementById('tpl-matriz-corte-v-activo');
  if (elCorteVActivo) m.corte_v_activo = elCorteVActivo.checked;

  const elCorteVModo = document.getElementById('tpl-matriz-corte-v-modo');
  if (elCorteVModo) m.corte_v_modo = elCorteVModo.value || m.corte_v_modo || 'pegadas';
}

async function saveTemplate() {
  if (!currentTemplate) {
    alert('No hay ninguna plantilla seleccionada para guardar.');
    return;
  }

  // Sincronizar todos los datos del formulario DOM antes de guardar
  syncTemplateFromUI();

  if (!currentTemplate.nombre || !currentTemplate.nombre.trim()) {
    alert('Asigna un nombre a la plantilla antes de guardar.');
    return;
  }

  const trimmedName = currentTemplate.nombre.trim();
  const currentId = currentTemplate.id != null ? Number(currentTemplate.id) : null;
  const collision = cachedTemplatesList.some(t => 
    (t.nombre || '').trim().toLowerCase() === trimmedName.toLowerCase() && 
    Number(t.id) !== currentId
  );
  if (collision) {
    alert(`⚠️ Ya existe una plantilla con el nombre "${trimmedName}". Por favor, elige un nombre diferente antes de guardar.`);
    return;
  }

  // Normalizar antes de guardar para garantizar integridad del payload
  _normalizarPlantilla(currentTemplate);

  try {
    // PUT si tiene ID numérico válido, POST si es nueva (id === null)
    const isEdit = currentTemplate.id != null && Number(currentTemplate.id) > 0;
    const url    = isEdit ? `/api/templates/${currentTemplate.id}` : '/api/templates';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentTemplate)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al guardar plantilla');

    if (!isEdit && data.id) {
      currentTemplate.id = Number(data.id);
    }

    alert(`✅ Plantilla "${currentTemplate.nombre}" guardada con éxito.`);
    await loadTemplateSelectOptions();
    if (currentTemplate.id) {
      const select = document.getElementById('editor-template-select') || document.getElementById('tpl-selector');
      if (select) select.value = String(currentTemplate.id);
    }
  } catch (err) {
    alert('Error al guardar plantilla: ' + err.message);
  }
}

// Exponer funciones globalmente en window
window.currentTemplate = currentTemplate;
window.FIELD_DEFINITIONS = FIELD_DEFINITIONS;
window.SYSTEM_FONTS = SYSTEM_FONTS;
window.historyUndo = historyUndo;
window.historyRedo = historyRedo;
window.initEditorModule = initEditorModule;
window.setEditorEmptyState = setEditorEmptyState;
window.exitEditorEmptyState = exitEditorEmptyState;
window.pushHistoryState = pushHistoryState;
window.undoAction = undoAction;
window.redoAction = redoAction;
window.updateUndoRedoButtons = updateUndoRedoButtons;
window._normalizarPlantilla = _normalizarPlantilla;
window.syncUIWithTemplate = syncUIWithTemplate;
window.switchEditorTab = switchEditorTab;
window.handleEditorKeyDown = handleEditorKeyDown;
window.initSplitters = initSplitters;
window.loadTemplateSelectOptions = loadTemplateSelectOptions;
window.loadTemplateById = loadTemplateById;
window.handleTemplateSelectChange = handleTemplateSelectChange;
window.loadTemplateForEdit = loadTemplateForEdit;
window.createNewTemplate = createNewTemplate;
window.openNewTemplateModal = openNewTemplateModal;
window.closeNewTemplateModal = closeNewTemplateModal;
window.selectNewTemplateMode = selectNewTemplateMode;
window.validateNewTemplateName = validateNewTemplateName;
window.confirmCreateNewTemplate = confirmCreateNewTemplate;
window.confirmDeleteTemplate = confirmDeleteTemplate;
window.deleteCurrentTemplate = deleteCurrentTemplate;
window.saveTemplate = saveTemplate;
window.syncTemplateFromUI = syncTemplateFromUI;
window.normalizeTemplate = _normalizarPlantilla;