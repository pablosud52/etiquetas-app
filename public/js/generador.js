// =========================================================================
// MÓDULO 1: GENERADOR DE ETIQUETAS E IMPOSICIÓN EN HOJA A4
// =========================================================================

let allGenProducts = [];
let filteredGenProducts = [];
let allGenTemplates = [];
let activeGenTemplate = null;

// Mapa de productos seleccionados y sus copias: { productId: cantidad }
// Solo contiene entradas con qty >= 1 (productos efectivamente seleccionados)
let selectedBatch = new Map();

// Estado de paginación y visualización
let currentPageIndex = 0; // 0-indexed
let totalPagesCount = 1;
let includeGuiaCorte = true;
let customCorteConfig = null; // Ajustes temporales del operador para la sesión

// Inicialización del Módulo 1
async function initGeneradorModule() {
  // Comprobar rol de usuario para activar funciones de Administrador
  applyAdminControlsInGenerador();

  window.removeEventListener('resize', fitGenSheetToViewport);
  window.addEventListener('resize', fitGenSheetToViewport);

  if (typeof loadInstalledFonts === 'function') {
    await loadInstalledFonts();
  }

  await Promise.all([
    checkObsolescenciaInGenerador(),
    loadGenTemplatesSelect(),
    loadGenProductsCatalog()
  ]);

  updateBatchCounterAndSummary();
  updateGuiaCorteToggleUI();
  updateTemplateSelectorUIState();
  fitGenSheetToViewport();
}

// Aplicar visibilidad de controles exclusivos para Administrador
function applyAdminControlsInGenerador() {
  const isAdmin = currentUser && (currentUser.rol || currentUser.role || '').toLowerCase().includes('admin');
  
  const btnEditTpl = document.getElementById('btn-admin-edit-template');

  if (btnEditTpl) {
    if (isAdmin) btnEditTpl.classList.remove('hidden');
    else btnEditTpl.classList.add('hidden');
  }
}

// Ir directamente al Editor (Módulo 2) cargando la plantilla activa
function goToEditorModule() {
  if (activeGenTemplate && activeGenTemplate.id) {
    localStorage.setItem('edit_template_id', activeGenTemplate.id);
  }
  loadComponent('plantillas');
}

// Comprobar obsolescencia y mostrar banner de alerta
async function checkObsolescenciaInGenerador() {
  const alertContainer = document.getElementById('gen-obsolescencia-alert');
  if (!alertContainer) return;

  try {
    const res = await fetch('/api/config/obsolescencia');
    if (!res.ok) return;

    const data = await res.json();
    if (!data.success) return;

    if (data.esta_obsoleto) {
      alertContainer.className = 'w-auto max-w-2xl mx-auto rounded-2xl px-5 py-2 bg-amber-950/40 border border-amber-500/50 text-amber-200 shadow-md flex flex-col items-center justify-center text-center animate-pulse';
      alertContainer.innerHTML = `
        <div class="flex items-center justify-center gap-2 text-xs font-medium whitespace-nowrap">
          <span class="text-amber-400 font-bold">⚠️</span>
          <span><strong class="text-amber-300">ALERTA DE OBSOLESCENCIA DE PRECIOS:</strong> <span class="text-white">${data.mensaje}</span></span>
        </div>
        <div class="flex items-center justify-center gap-3 mt-1 text-xs">
          <span class="text-amber-300/90 font-mono font-medium">${data.total_productos || 0} productos</span>
          <button onclick="loadComponent('datos')" class="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[10px] rounded transition-colors shadow cursor-pointer">
            Actualizar Lista
          </button>
        </div>
      `;
      alertContainer.classList.remove('hidden');
    } else {
      alertContainer.className = 'w-auto max-w-2xl mx-auto rounded-2xl px-6 py-2.5 bg-slate-900/85 border border-emerald-500/40 shadow-inner flex flex-col items-center justify-center text-center';
      alertContainer.innerHTML = `
        <div class="flex items-center justify-center gap-2 text-xs whitespace-nowrap">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] shrink-0"></span>
          <span class="font-bold text-emerald-400">Lista de Precios al Día:</span>
          <span class="text-white font-normal">${data.mensaje}</span>
        </div>
        <div class="text-xs text-emerald-400 font-mono mt-1 font-medium">
          ${data.total_productos} productos listos
        </div>
      `;
      alertContainer.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error al verificar obsolescencia en generador:', err);
  }
}

// Cargar plantillas registradas
async function loadGenTemplatesSelect() {
  const select = document.getElementById('gen-plantilla');
  if (!select) return;

  try {
    const res = await fetch('/api/templates');
    if (!res.ok) return;

    allGenTemplates = await res.json();
    allGenTemplates.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base', numeric: true }));
    select.innerHTML = '<option value="">-- Seleccionar Plantilla --</option>';

    allGenTemplates.forEach(t => {
      const option = document.createElement('option');
      option.value = t.id;
      option.textContent = t.nombre || `Plantilla #${t.id}`;
      select.appendChild(option);
    });

    // Si viene redireccionado desde el Editor
    const autoSelectId = localStorage.getItem('edit_template_id');
    if (autoSelectId) {
      localStorage.removeItem('edit_template_id');
      select.value = autoSelectId;
      handleGeneradorTemplateChange(autoSelectId);
    } else {
      // Al inicio siempre en posición neutra (-- Seleccionar Plantilla --)
      select.value = '';
      handleGeneradorTemplateChange('');
    }
  } catch (err) {
    console.error('Error al cargar plantillas en generador:', err);
  }
}

// =========================================================================
// UTILIDADES DE BÚSQUEDA Y NORMALIZACIÓN (COMPARTIDAS)
// =========================================================================

// Normalizar texto eliminando mayúsculas y diacríticos/acentos
function normalizeSearchText(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Comprueba si el tamaño del producto coincide con el tamaño requerido por la plantilla
function matchesTemplateSize(productTamano, templateTamano) {
  if (!templateTamano) return true;
  const tSize = templateTamano.toLowerCase().trim();
  if (!tSize || tSize === 'personalizado' || tSize === '-- todos los tamaños --') {
    return true;
  }
  const pSize = (productTamano || '').toLowerCase().trim();
  if (tSize === '__empty__' || tSize === '(vacíos)') {
    return pSize === '';
  }
  return pSize === tSize || pSize.includes(tSize) || tSize.includes(pSize);
}

// Actualizar aspecto del SELECTOR y banner informativo según haya o no plantilla activa
function updateTemplateSelectorUIState() {
  const banner = document.getElementById('gen-no-tpl-banner');
  const select = document.getElementById('gen-plantilla');
  const btnClear = document.getElementById('btn-clear-selection');

  if (!activeGenTemplate) {
    if (banner) banner.classList.remove('hidden');
    if (select) {
      select.classList.add('border-amber-500/60', 'ring-1', 'ring-amber-500/30');
      select.classList.remove('border-slate-700');
    }
    if (btnClear) btnClear.disabled = true;
  } else {
    if (banner) banner.classList.add('hidden');
    if (select) {
      select.classList.remove('border-amber-500/60', 'ring-1', 'ring-amber-500/30');
      select.classList.add('border-slate-700');
    }
    if (btnClear) btnClear.disabled = selectedBatch.size === 0;
  }
}

// Al cambiar la plantilla activa en el Generador
function handleGeneradorTemplateChange(templateId) {
  if (!templateId) {
    activeGenTemplate = null;
    updateCapacidadDisplay(0);
    filterGeneradorProducts();
    updateBatchCounterAndSummary();
    renderGeneradorPagePreview();
    updateTemplateSelectorUIState();
    return;
  }

  activeGenTemplate = allGenTemplates.find(t => t.id == templateId) || null;
  customCorteConfig = null; // Restablecer personalizaciones de corte a las de la plantilla

  if (activeGenTemplate) {
    if (typeof activeGenTemplate.matriz_a4 === 'string') {
      try { activeGenTemplate.matriz_a4 = JSON.parse(activeGenTemplate.matriz_a4); } catch (_) {}
    }
    if (typeof normalizeTemplate === 'function') {
      normalizeTemplate(activeGenTemplate);
    } else if (typeof _normalizarPlantilla === 'function') {
      _normalizarPlantilla(activeGenTemplate);
    }
    const dims = getTemplateMmDimensions(activeGenTemplate);
    updateCapacidadDisplay(dims.cols * dims.rows);
  }

  currentPageIndex = 0;
  filterGeneradorProducts();
  updateBatchCounterAndSummary();
  renderGeneradorPagePreview();
  updateTemplateSelectorUIState();
}

function updateCapacidadDisplay(capacidad) {
  const badgeText = document.getElementById('gen-capacidad-text');
  if (badgeText) {
    badgeText.textContent = capacidad > 0 ? `${capacidad} etiq / hoja A4` : '- etiq / hoja A4';
  }
}

// Cargar lista completa de productos y precomputar índice de búsqueda en memoria
async function loadGenProductsCatalog() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) return;

    allGenProducts = await res.json();
    allGenProducts.forEach(p => {
      p._searchIndex = normalizeSearchText([
        p.cod_1, p.cod_2, p.producto, p.title,
        p.spec_1, p.spec_2, p.spec_3, p.spec_4, p.spec_5,
        p.etiqueta_tamano
      ].filter(Boolean).join(' '));
    });

    filterGeneradorProducts();
  } catch (err) {
    console.error('Error al cargar productos en generador:', err);
  }
}

let genSearchDebounceTimer = null;

// Evento oninput del buscador: gestión de visibilidad del botón [X] y debounce
function onGeneradorSearchInput() {
  const searchInput = document.getElementById('gen-search');
  const clearBtn = document.getElementById('gen-search-clear');
  const val = searchInput ? searchInput.value : '';

  if (clearBtn) {
    if (val.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  clearTimeout(genSearchDebounceTimer);
  genSearchDebounceTimer = setTimeout(() => {
    filterGeneradorProducts();
  }, 120);
}

// Limpiar campo de búsqueda y restaurar filtrado de forma inmediata
function clearGeneradorSearch() {
  clearTimeout(genSearchDebounceTimer);
  const searchInput = document.getElementById('gen-search');
  const clearBtn = document.getElementById('gen-search-clear');

  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  if (clearBtn) {
    clearBtn.classList.add('hidden');
  }

  filterGeneradorProducts();
}

// Filtro dinámico: Plantilla (Tamaño) + Búsqueda por Tokens AND insensible a mayúsculas y acentos
function filterGeneradorProducts() {
  const searchInput = document.getElementById('gen-search');
  const rawQuery = searchInput ? searchInput.value : '';
  const normalizedQuery = normalizeSearchText(rawQuery);
  const tokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

  const templateSize = activeGenTemplate ? (activeGenTemplate.etiqueta_tamano || '') : '';

  // 1. Elementos existentes en la tabla que vienen definidos por el filtro de la plantilla activa
  const templateCompatibleProducts = allGenProducts.filter(p => {
    if (activeGenTemplate && !matchesTemplateSize(p.etiqueta_tamano, templateSize)) {
      return false;
    }
    return true;
  });

  const totalTemplateCount = templateCompatibleProducts.length;

  // 2. Coincidencia Total de Tokens sin Importar el Orden (Modo AND) sobre los productos de la plantilla
  if (tokens.length > 0) {
    filteredGenProducts = templateCompatibleProducts.filter(p => {
      const searchTarget = p._searchIndex || normalizeSearchText([
        p.cod_1, p.cod_2, p.producto, p.title,
        p.spec_1, p.spec_2, p.spec_3, p.spec_4, p.spec_5,
        p.etiqueta_tamano
      ].filter(Boolean).join(' '));

      return tokens.every(t => searchTarget.includes(t));
    });
  } else {
    filteredGenProducts = [...templateCompatibleProducts];
  }

  // 3. Actualizar contador dinámico de tabla (ej: 230 / 230, o 8 / 230 al filtrar)
  const tableCountEl = document.getElementById('gen-table-count');
  if (tableCountEl) {
    tableCountEl.textContent = `${filteredGenProducts.length} / ${totalTemplateCount}`;
  }

  renderGeneradorProductsTable();
}

// Renderizar tabla de selección de productos
// Columnas: Checkbox | COPIAS | CÓDIGO 1 | CÓDIGO 2 | DESCRIPCIÓN | MONEDA | PÚBLICO | DISTRIB
function renderGeneradorProductsTable() {
  const tbody = document.getElementById('gen-prod-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const isEnabled = !!activeGenTemplate;

  const chkToggleAll = document.getElementById('chk-toggle-all');
  if (chkToggleAll) {
    chkToggleAll.disabled = !isEnabled;
    if (!isEnabled) {
      chkToggleAll.checked = false;
      chkToggleAll.classList.add('opacity-30', 'cursor-not-allowed');
    } else {
      chkToggleAll.classList.remove('opacity-30', 'cursor-not-allowed');
    }
  }

  if (filteredGenProducts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-500">No se encontraron productos coincidentes.</td></tr>';
    return;
  }

  const disabledAttr = isEnabled ? '' : 'disabled';
  const chkClass = isEnabled ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed';
  const qtyClass = isEnabled ? 'bg-slate-900 focus:border-blue-500' : 'bg-slate-800/80 opacity-40 cursor-not-allowed';

  filteredGenProducts.forEach(p => {
    const isSelected = selectedBatch.has(p.id);
    const qty = isSelected ? (selectedBatch.get(p.id) || 1) : 0;

    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-700/40 transition-colors border-b border-slate-700/30 ${isSelected ? 'bg-blue-600/15' : ''}`;
    tr.id = `gen-row-${p.id}`;

    const precioPublico = Number(p.publico ?? 0).toFixed(2);
    const precioDistrib = Number(p.distribuidor ?? 0).toFixed(2);
    const moneda = p.moneda || '$';
    const cod1 = p.cod_1 || '-';
    const cod2 = p.cod_2 || '-';
    const titulo = p.title || '-';

    tr.innerHTML = `
      <td class="px-2 py-2 text-center">
        <input type="checkbox" ${isSelected ? 'checked' : ''} ${disabledAttr} onchange="toggleProductSelection(${p.id}, this.checked)" class="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 ${chkClass}">
      </td>
      <td class="px-2 py-1.5 text-center">
        <input type="number" id="qty-${p.id}" value="${qty}" min="0" max="999" ${disabledAttr}
          onchange="updateProductQuantity(${p.id}, this.value)"
          oninput="updateProductQuantity(${p.id}, this.value)"
          class="w-14 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-white font-mono focus:outline-none ${qtyClass}">
      </td>
      <td class="px-2 py-2 font-mono text-slate-300 font-medium text-[11px]">${cod1}</td>
      <td class="px-2 py-2 font-mono text-slate-400 text-[11px]">${cod2}</td>
      <td class="px-2 py-2 truncate max-w-[140px] text-white font-semibold text-[11px]" title="${titulo}">${titulo}</td>
      <td class="px-2 py-2 text-center text-slate-300 font-mono text-[11px]">${moneda}</td>
      <td class="px-2 py-2 text-right font-mono font-bold text-emerald-400 text-[11px]">${precioPublico}</td>
      <td class="px-2 py-2 text-right font-mono font-bold text-purple-400 text-[11px]">${precioDistrib}</td>
    `;
    tbody.appendChild(tr);
  });
}

// =========================================================================
// LÓGICA COPIAS ↔ CHECKBOX
// =========================================================================

// Selección individual: al marcar → copias=1, al desmarcar → copias=0 y eliminar del mapa
function toggleProductSelection(productId, isChecked) {
  if (!activeGenTemplate) {
    alert('Por favor selecciona una plantilla en el SELECTOR primero.');
    renderGeneradorProductsTable();
    return;
  }

  if (isChecked) {
    selectedBatch.set(productId, 1);
    const qtyInput = document.getElementById(`qty-${productId}`);
    if (qtyInput) qtyInput.value = 1;
    updateBatchCounterAndSummary(true); // Auto-avanzar si se abre una nueva página
  } else {
    selectedBatch.delete(productId);
    const qtyInput = document.getElementById(`qty-${productId}`);
    if (qtyInput) qtyInput.value = 0;
    updateBatchCounterAndSummary(false);
  }
  renderGeneradorProductsTable();
  renderGeneradorPagePreview();
}

// Actualizar cantidad de copias para un producto
// qty >= 1 → seleccionar (marcar checkbox), qty = 0 → deseleccionar (desmarcar checkbox)
function updateProductQuantity(productId, val) {
  if (!activeGenTemplate) {
    alert('Por favor selecciona una plantilla en el SELECTOR primero.');
    renderGeneradorProductsTable();
    return;
  }

  const qty = parseInt(val, 10);
  const safeQty = isNaN(qty) ? 0 : Math.max(0, qty);
  const prevQty = selectedBatch.get(productId) || 0;

  if (safeQty === 0) {
    selectedBatch.delete(productId);
  } else {
    selectedBatch.set(productId, safeQty);
  }

  // Sincronizar estado del checkbox en el DOM sin re-renderizar toda la tabla
  const row = document.getElementById(`gen-row-${productId}`);
  if (row) {
    const chk = row.querySelector('input[type="checkbox"]');
    if (chk) chk.checked = safeQty > 0;
    // Resaltar/desresaltar fila
    if (safeQty > 0) {
      row.classList.add('bg-blue-600/15');
    } else {
      row.classList.remove('bg-blue-600/15');
    }
  }

  updateBatchCounterAndSummary(safeQty > prevQty); // Auto-avanzar si se incrementaron las copias y crea hoja nueva
  renderGeneradorPagePreview();
}

// Selección / deselección masiva (solo actúa sobre los productos filtrados visibles)
function selectAllProducts(isChecked) {
  if (!activeGenTemplate) {
    const toggleAllChk = document.getElementById('chk-toggle-all');
    if (toggleAllChk) toggleAllChk.checked = false;
    alert('Por favor selecciona una plantilla en el SELECTOR primero.');
    return;
  }

  filteredGenProducts.forEach(p => {
    if (isChecked) {
      if (!selectedBatch.has(p.id)) selectedBatch.set(p.id, 1);
    } else {
      selectedBatch.delete(p.id);
    }
  });

  const toggleAllChk = document.getElementById('chk-toggle-all');
  if (toggleAllChk) toggleAllChk.checked = isChecked;

  updateBatchCounterAndSummary();
  renderGeneradorProductsTable();
  renderGeneradorPagePreview();
}

// Limpiar selección completa: desmarcar todas y reiniciar copias a 0
function clearBatchSelection() {
  if (!activeGenTemplate || selectedBatch.size === 0) return;
  selectedBatch.clear();
  const toggleAllChk = document.getElementById('chk-toggle-all');
  if (toggleAllChk) toggleAllChk.checked = false;

  updateBatchCounterAndSummary();
  renderGeneradorProductsTable();
  renderGeneradorPagePreview();
}

// =========================================================================
// TOGGLE DE GUÍAS DE CORTE
// =========================================================================

// Alternar el estado de las guías de corte mediante el botón toggle
function toggleGuiaCorteBtn() {
  includeGuiaCorte = !includeGuiaCorte;
  updateGuiaCorteToggleUI();
  renderGeneradorPagePreview();
}

// Actualizar la apariencia visual del botón toggle según el estado actual
function updateGuiaCorteToggleUI() {
  const group = document.getElementById('btn-guia-corte-group');
  const sub = document.getElementById('btn-guia-corte-sub');
  const divider = document.getElementById('btn-guia-corte-divider');
  if (!group) return;

  if (includeGuiaCorte) {
    // Estado ACTIVO: celeste oscuro / blue-600
    group.className = 'h-14 bg-blue-600 border border-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-stretch overflow-hidden shrink-0';
    if (sub) sub.className = 'text-[11px] font-semibold text-blue-100';
    if (divider) divider.className = 'w-[1px] bg-blue-400/40 my-2.5';
  } else {
    // Estado INACTIVO: oscuro / slate-900
    group.className = 'h-14 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white rounded-xl transition-all shadow-md flex items-stretch overflow-hidden shrink-0';
    if (sub) sub.className = 'text-[11px] font-semibold text-slate-500';
    if (divider) divider.className = 'w-[1px] bg-slate-700/80 my-2.5';
  }
}

// =========================================================================
// AJUSTES DE GUÍAS DE CORTE (MODAL OPERADOR)
// =========================================================================
// AJUSTES DE GUÍAS DE CORTE (MODAL OPERADOR CON LIENZO EN TIEMPO REAL)
// =========================================================================

let modalCorteZoom = 1.0;
const MODAL_CORTE_BASE_H = 640;
let isModalCortePanning = false;
let modalCorteStartX = 0;
let modalCorteStartY = 0;
let modalCorteScrollLeft = 0;
let modalCorteScrollTop = 0;
let modalCortePanInitialized = false;

// Obtener la configuración activa de corte (priorizando la personalización en sesión del operador)
function getActiveCorteConfig() {
  const tplM = activeGenTemplate?.matriz_a4 || {};
  return {
    corte_tipo: customCorteConfig?.corte_tipo ?? (tplM.corte_tipo || 'solid'),
    corte_grosor: customCorteConfig?.corte_grosor ?? (parseInt(tplM.corte_grosor, 10) || 1),
    corte_color: customCorteConfig?.corte_color ?? (tplM.corte_color || '#94a3b8'),
    corte_h_activo: customCorteConfig?.corte_h_activo ?? (tplM.corte_h_activo !== false),
    corte_h_modo: customCorteConfig?.corte_h_modo ?? (tplM.corte_h_modo || 'pegadas'),
    corte_v_activo: customCorteConfig?.corte_v_activo ?? (tplM.corte_v_activo !== false),
    corte_v_modo: customCorteConfig?.corte_v_modo ?? (tplM.corte_v_modo || 'pegadas')
  };
}

// Abrir ajustes de guías de corte en modal para el operador
function openGuiaCorteSettings() {
  if (!activeGenTemplate) {
    alert('Por favor selecciona una plantilla en el SELECTOR primero para ajustar sus guías de corte.');
    return;
  }

  const modal = document.getElementById('modal-gen-corte-settings');
  if (!modal) return;

  const cfg = getActiveCorteConfig();
  const elTipo = document.getElementById('gen-corte-tipo');
  const elGrosor = document.getElementById('gen-corte-grosor');
  const elColor = document.getElementById('gen-corte-color');
  const elHActivo = document.getElementById('gen-corte-h-activo');
  const elHModo = document.getElementById('gen-corte-h-modo');
  const elVActivo = document.getElementById('gen-corte-v-activo');
  const elVModo = document.getElementById('gen-corte-v-modo');

  if (elTipo) elTipo.value = cfg.corte_tipo;
  if (elGrosor) elGrosor.value = cfg.corte_grosor;
  if (elColor) elColor.value = cfg.corte_color;
  if (elHActivo) elHActivo.checked = cfg.corte_h_activo;
  if (elHModo) elHModo.value = cfg.corte_h_modo;
  if (elVActivo) elVActivo.checked = cfg.corte_v_activo;
  if (elVModo) elVModo.value = cfg.corte_v_modo;

  // Actualizar badges del encabezado
  const badgeTpl = document.getElementById('modal-corte-tpl-badge');
  if (badgeTpl) {
    badgeTpl.textContent = activeGenTemplate.nombre || 'Plantilla Activa';
  }

  const m = activeGenTemplate.matriz_a4 || {};
  const totalEtiq = (parseInt(m.columnas, 10) || 2) * (parseInt(m.filas, 10) || 4);
  const badgeMetric = document.getElementById('modal-corte-metric-badge');
  if (badgeMetric) {
    badgeMetric.textContent = `${activeGenTemplate.ancho || 10.0}x${activeGenTemplate.alto || 5.0} cm | ${totalEtiq} etiq / pliego`;
  }

  modalCorteZoom = 1.0;
  updateModalCorteZoomDisplay();

  modal.classList.remove('hidden');
  initModalCortePan();
  renderModalCortePreview();
}

function closeGuiaCorteSettings() {
  const modal = document.getElementById('modal-gen-corte-settings');
  if (!modal) return;
  modal.classList.add('hidden');
}

function applyGuiaCorteSettings() {
  const elTipo = document.getElementById('gen-corte-tipo');
  const elGrosor = document.getElementById('gen-corte-grosor');
  const elColor = document.getElementById('gen-corte-color');
  const elHActivo = document.getElementById('gen-corte-h-activo');
  const elHModo = document.getElementById('gen-corte-h-modo');
  const elVActivo = document.getElementById('gen-corte-v-activo');
  const elVModo = document.getElementById('gen-corte-v-modo');

  customCorteConfig = {
    corte_tipo: elTipo ? elTipo.value : 'solid',
    corte_grosor: elGrosor ? (parseInt(elGrosor.value, 10) || 1) : 1,
    corte_color: elColor ? elColor.value : '#94a3b8',
    corte_h_activo: elHActivo ? elHActivo.checked : true,
    corte_h_modo: elHModo ? elHModo.value : 'pegadas',
    corte_v_activo: elVActivo ? elVActivo.checked : true,
    corte_v_modo: elVModo ? elVModo.value : 'pegadas'
  };

  closeGuiaCorteSettings();
  renderGeneradorPagePreview();
}

function resetGuiaCorteSettingsToTemplate() {
  customCorteConfig = null;
  const tplM = activeGenTemplate?.matriz_a4 || {};
  const elTipo = document.getElementById('gen-corte-tipo');
  const elGrosor = document.getElementById('gen-corte-grosor');
  const elColor = document.getElementById('gen-corte-color');
  const elHActivo = document.getElementById('gen-corte-h-activo');
  const elHModo = document.getElementById('gen-corte-h-modo');
  const elVActivo = document.getElementById('gen-corte-v-activo');
  const elVModo = document.getElementById('gen-corte-v-modo');

  if (elTipo) elTipo.value = tplM.corte_tipo || 'solid';
  if (elGrosor) elGrosor.value = parseInt(tplM.corte_grosor, 10) || 1;
  if (elColor) elColor.value = tplM.corte_color || '#94a3b8';
  if (elHActivo) elHActivo.checked = tplM.corte_h_activo !== false;
  if (elHModo) elHModo.value = tplM.corte_h_modo || 'pegadas';
  if (elVActivo) elVActivo.checked = tplM.corte_v_activo !== false;
  if (elVModo) elVModo.value = tplM.corte_v_modo || 'pegadas';

  renderModalCortePreview();
}

// Renderizado vectorial en tiempo real del Pliego A4 dentro del modal
function renderModalCortePreview() {
  const sheet = document.getElementById('modal-corte-sheet');
  if (!sheet || !activeGenTemplate) return;

  const corteTipo = document.getElementById('gen-corte-tipo')?.value || 'solid';
  const corteGrosor = parseInt(document.getElementById('gen-corte-grosor')?.value, 10) || 1;
  const corteColor = document.getElementById('gen-corte-color')?.value || '#94a3b8';
  const corteHActivo = document.getElementById('gen-corte-h-activo') ? document.getElementById('gen-corte-h-activo').checked : true;
  const corteHModo = document.getElementById('gen-corte-h-modo')?.value || 'pegadas';
  const corteVActivo = document.getElementById('gen-corte-v-activo') ? document.getElementById('gen-corte-v-activo').checked : true;
  const corteVModo = document.getElementById('gen-corte-v-modo')?.value || 'pegadas';

  const m = activeGenTemplate.matriz_a4 || {};
  const cols = parseInt(m.columnas, 10) || 2;
  const rows = parseInt(m.filas, 10) || 4;
  let mTop = !isNaN(parseFloat(m.margin_top)) ? parseFloat(m.margin_top) : 1.0;
  let mLeft = !isNaN(parseFloat(m.margin_left)) ? parseFloat(m.margin_left) : 1.0;
  let gapX = !isNaN(parseFloat(m.gap_x)) ? parseFloat(m.gap_x) : 0.0;
  let gapY = !isNaN(parseFloat(m.gap_y)) ? parseFloat(m.gap_y) : 0.0;
  if (mTop > 5) mTop /= 10;
  if (mLeft > 5) mLeft /= 10;
  if (gapX > 3) gapX /= 10;
  if (gapY > 3) gapY /= 10;

  let labelW_cm = parseFloat(activeGenTemplate.ancho ?? 10.0);
  let labelH_cm = parseFloat(activeGenTemplate.alto ?? 5.0);
  if (labelW_cm > 30) labelW_cm /= 10;
  if (labelH_cm > 30) labelH_cm /= 10;

  const baseH = MODAL_CORTE_BASE_H;
  const baseW = baseH * (21.0 / 29.7);
  const scale = baseW / 21.0;

  sheet.style.width = `${baseW}px`;
  sheet.style.height = `${baseH}px`;
  applyModalCorteZoomTransform();
  updateModalCorteZoomDisplay();
  sheet.innerHTML = '';

  // Dibujar etiquetas unitarias (#1, #2, ...)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x_cm = mLeft + c * (labelW_cm + gapX);
      const y_cm = mTop + r * (labelH_cm + gapY);

      const labelDiv = document.createElement('div');
      labelDiv.className = 'absolute bg-slate-100/90 border border-blue-400/40 rounded-sm flex items-center justify-center text-[10px] text-slate-500 font-bold overflow-hidden shadow-sm';
      labelDiv.style.left = `${x_cm * scale}px`;
      labelDiv.style.top = `${y_cm * scale}px`;
      labelDiv.style.width = `${labelW_cm * scale}px`;
      labelDiv.style.height = `${labelH_cm * scale}px`;

      const activeSlotIdx = activeGenTemplate.slot_activo || 0;
      const activeSlot = (activeGenTemplate.slots_fondo || [])[activeSlotIdx >= 0 && activeSlotIdx < 3 ? activeSlotIdx : -1];
      if (activeSlot && activeSlot.url) {
        labelDiv.style.backgroundImage = `url('${activeSlot.url}')`;
        labelDiv.style.backgroundSize = '100% 100%';
        labelDiv.style.backgroundPosition = 'center';
      }

      labelDiv.textContent = `#${r * cols + c + 1}`;
      sheet.appendChild(labelDiv);
    }
  }

  // Dibujar líneas de corte de borde a borde A4
  if (typeof renderCutLinesHelper === 'function') {
    renderCutLinesHelper(sheet, {
      cols, rows, mTop, mLeft, gapX, gapY, labelW_cm, labelH_cm, scale,
      corteTipo, corteGrosor, corteColor,
      corteHActivo, corteHModo, corteVActivo, corteVModo
    });
  }
}

// Controles de Zoom del modal
function adjustModalCorteZoom(delta) {
  modalCorteZoom = Math.max(0.3, Math.min(3.0, parseFloat((modalCorteZoom + delta).toFixed(2))));
  updateModalCorteZoomDisplay();
  applyModalCorteZoomTransform();
}

function resetModalCorteZoom() {
  modalCorteZoom = 1.0;
  updateModalCorteZoomDisplay();
  applyModalCorteZoomTransform();
  const viewport = document.getElementById('modal-corte-viewport');
  if (viewport) {
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
  }
}

function updateModalCorteZoomDisplay() {
  const disp = document.getElementById('modal-corte-zoom-display');
  if (disp) disp.textContent = `${Math.round(modalCorteZoom * 100)}%`;
}

function applyModalCorteZoomTransform() {
  const sheet = document.getElementById('modal-corte-sheet');
  if (sheet) {
    sheet.style.transform = `scale(${modalCorteZoom})`;
    sheet.style.transformOrigin = 'center top';
    sheet.style.marginBottom = modalCorteZoom > 1.0 ? `${(MODAL_CORTE_BASE_H * modalCorteZoom) - MODAL_CORTE_BASE_H + 40}px` : '0px';
  }
}

// Inicializar navegación por arrastre con guante (Grab / Grabbing)
function initModalCortePan() {
  const viewport = document.getElementById('modal-corte-viewport');
  if (!viewport || modalCortePanInitialized) return;

  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isModalCortePanning = true;
    viewport.classList.remove('cursor-grab');
    viewport.classList.add('cursor-grabbing');
    viewport.style.userSelect = 'none';
    modalCorteStartX = e.pageX - viewport.offsetLeft;
    modalCorteStartY = e.pageY - viewport.offsetTop;
    modalCorteScrollLeft = viewport.scrollLeft;
    modalCorteScrollTop = viewport.scrollTop;
  });

  window.addEventListener('mouseup', () => {
    if (isModalCortePanning) {
      isModalCortePanning = false;
      const vp = document.getElementById('modal-corte-viewport');
      if (vp) {
        vp.classList.remove('cursor-grabbing');
        vp.classList.add('cursor-grab');
        vp.style.removeProperty('user-select');
      }
    }
  });

  viewport.addEventListener('mousemove', (e) => {
    if (!isModalCortePanning) return;
    e.preventDefault();
    const x = e.pageX - viewport.offsetLeft;
    const y = e.pageY - viewport.offsetTop;
    const walkX = (x - modalCorteStartX);
    const walkY = (y - modalCorteStartY);
    viewport.scrollLeft = modalCorteScrollLeft - walkX;
    viewport.scrollTop = modalCorteScrollTop - walkY;
  });

  // Zoom con Ctrl + Rueda del ratón
  viewport.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      adjustModalCorteZoom(e.deltaY < 0 ? 0.15 : -0.15);
    }
  }, { passive: false });

  modalCortePanInitialized = true;
}

// Atajo de teclado: Cerrar modal con tecla Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('modal-gen-corte-settings');
    if (modal && !modal.classList.contains('hidden')) {
      e.preventDefault();
      closeGuiaCorteSettings();
    }
  }
});

// =========================================================================
// CONTADOR Y RESUMEN DEL LOTE
// =========================================================================

// Actualizar resumen del lote e imposición A4
// El contador de filas únicas = tamaño del mapa selectedBatch (qty >= 1)
function updateBatchCounterAndSummary(autoAdvance = false) {
  // Filas únicas seleccionadas (productos distintos con qty >= 1)
  const uniqueSelected = selectedBatch.size;

  // Total de etiquetas (suma de copias) para el cálculo de hojas
  let totalLabels = 0;
  selectedBatch.forEach(qty => totalLabels += qty);

  const selectedCountEl = document.getElementById('gen-selected-summary');
  if (selectedCountEl) {
    selectedCountEl.innerHTML = `<span>${uniqueSelected} seleccionados</span> <span class="text-emerald-500/70 font-normal">/</span> <span>${totalLabels} <span class="font-normal text-emerald-400/90">para imprimir</span></span>`;
  }

  // Actualizar estado del botón [ Limpiar selección ]
  const btnClear = document.getElementById('btn-clear-selection');
  if (btnClear) {
    btnClear.disabled = !activeGenTemplate || selectedBatch.size === 0;
  }

  // Actualizar estado visual del botón [ Generar PDF / Imprimir ]
  const btnPdf = document.getElementById('btn-pdf-gen');
  if (btnPdf) {
    const canPrint = !!activeGenTemplate && totalLabels > 0;
    if (canPrint) {
      btnPdf.classList.remove('opacity-40', 'cursor-not-allowed');
      btnPdf.classList.add('cursor-pointer');
    } else {
      btnPdf.classList.add('opacity-40', 'cursor-not-allowed');
      btnPdf.classList.remove('cursor-pointer');
    }
  }

  const cols = activeGenTemplate?.matriz_a4?.columnas || 2;
  const rows = activeGenTemplate?.matriz_a4?.filas || 4;
  const capacidad = cols * rows;

  const prevTotalPages = totalPagesCount;
  if (capacidad > 0 && totalLabels > 0) {
    totalPagesCount = Math.ceil(totalLabels / capacidad);
  } else {
    totalPagesCount = 1;
  }

  // Avance automático: si se abrió una página nueva con la adición, saltar a la última página
  if (autoAdvance && totalPagesCount > prevTotalPages) {
    currentPageIndex = totalPagesCount - 1;
  } else if (currentPageIndex >= totalPagesCount) {
    currentPageIndex = Math.max(0, totalPagesCount - 1);
  }

  // Resumen del panel derecho
  const summaryEl = document.getElementById('gen-lote-summary-text');
  if (summaryEl) {
    if (totalLabels === 0) {
      summaryEl.textContent = '0 seleccionados ➔ 0 Hojas A4';
    } else {
      let breakdown = [];
      let rem = totalLabels;
      for (let p = 1; p <= totalPagesCount; p++) {
        const countThisPage = Math.min(rem, capacidad);
        breakdown.push(`Pág ${p}: ${countThisPage}`);
        rem -= countThisPage;
      }
      summaryEl.textContent = `${totalLabels} seleccionados ➔ ${totalPagesCount} Hoja(s) A4 (${breakdown.join(', ')})`;
    }
  }

  // Actualizar paginador UI
  const pageDisplay = document.getElementById('page-num-display');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  if (pageDisplay) {
    pageDisplay.textContent = `Página < ${currentPageIndex + 1} / ${totalPagesCount} >`;
  }
  if (btnPrev) btnPrev.disabled = currentPageIndex === 0;
  if (btnNext) btnNext.disabled = currentPageIndex >= totalPagesCount - 1;
}

function changePage(delta) {
  currentPageIndex = Math.max(0, Math.min(totalPagesCount - 1, currentPageIndex + delta));
  updateBatchCounterAndSummary();
  renderGeneradorPagePreview();
}

// =========================================================================
// RENDERIZADO DEL PLIEGO HOJA A4 (PREVISUALIZACIÓN Y VISTA PREVIA)
// =========================================================================

// Conversión unificada de dimensiones de plantilla a milímetros reales (A4: 210 x 297 mm)
function getTemplateMmDimensions(template) {
  if (!template) {
    return {
      labelW_mm: 100,
      labelH_mm: 50,
      mTop: 10,
      mLeft: 10,
      gapX: 5,
      gapY: 5,
      cols: 2,
      rows: 4,
      m: {}
    };
  }

  const m = template.matriz_a4 || {};
  const cols = parseInt(m.columnas, 10) || 2;
  const rows = parseInt(m.filas, 10) || 4;

  let rawW = parseFloat(template.ancho) || 10.0;
  let rawH = parseFloat(template.alto) || 5.0;
  // Si ancho <= 30 se asume cm (guardado en SQLite como cm), se convierte a mm (*10)
  const labelW_mm = rawW > 30 ? rawW : rawW * 10;
  const labelH_mm = rawH > 30 ? rawH : rawH * 10;

  let rawMTop = !isNaN(parseFloat(m.margin_top)) ? parseFloat(m.margin_top) : 1.0;
  let rawMLeft = !isNaN(parseFloat(m.margin_left)) ? parseFloat(m.margin_left) : 1.0;
  let rawGapX = !isNaN(parseFloat(m.gap_x)) ? parseFloat(m.gap_x) : 0.0;
  let rawGapY = !isNaN(parseFloat(m.gap_y)) ? parseFloat(m.gap_y) : 0.0;

  const mTop = rawMTop > 5 ? rawMTop : rawMTop * 10;
  const mLeft = rawMLeft > 5 ? rawMLeft : rawMLeft * 10;
  const gapX = rawGapX > 5 ? rawGapX : rawGapX * 10;
  const gapY = rawGapY > 5 ? rawGapY : rawGapY * 10;

  return { labelW_mm, labelH_mm, mTop, mLeft, gapX, gapY, cols, rows, m };
}

// Ajuste dinámico de escala del pliego A4 al viewport visible para evitar desbordes
function fitGenSheetToViewport() {
  const viewport = document.getElementById('print-sheet-viewport');
  const scaler = document.getElementById('gen-sheet-scaler');
  const sheet = document.getElementById('gen-print-sheet');
  if (!viewport || !sheet || !scaler) return;

  const availW = viewport.clientWidth - 24;
  const availH = viewport.clientHeight - 24;
  if (availW <= 0 || availH <= 0) return;

  // Medidas de hoja A4 a 96 DPI: 210mm = 793.7px, 297mm = 1122.5px
  const baseW = 793.7;
  const baseH = 1122.5;

  const scale = Math.min(availW / baseW, availH / baseH);

  sheet.style.transform = `scale(${scale})`;
  sheet.style.transformOrigin = 'center center';

  scaler.style.width = `${baseW * scale}px`;
  scaler.style.height = `${baseH * scale}px`;
}

// Renderizar contenido A4 de una página específica en un contenedor objetivo
function renderA4SheetPageContent(container, pageIndex) {
  container.innerHTML = '';
  if (!activeGenTemplate) return;

  const dims = getTemplateMmDimensions(activeGenTemplate);
  const { cols, rows, mTop, mLeft, gapX, gapY, labelW_mm, labelH_mm } = dims;
  const capacidad = cols * rows;

  // Construir lista plana de todos los items de etiquetas a imprimir
  const flatItemsList = [];
  selectedBatch.forEach((qty, prodId) => {
    const prod = allGenProducts.find(p => p.id == prodId);
    if (prod) {
      for (let i = 0; i < qty; i++) {
        flatItemsList.push(prod);
      }
    }
  });

  const startIndex = pageIndex * capacidad;
  const pageItems = flatItemsList.slice(startIndex, startIndex + capacidad);

  // Renderizar etiquetas de la página activa usando posicionamiento en mm
  for (let idx = 0; idx < pageItems.length; idx++) {
    const prod = pageItems[idx];
    const r = Math.floor(idx / cols);
    const c = idx % cols;

    const x_mm = mLeft + c * (labelW_mm + gapX);
    const y_mm = mTop + r * (labelH_mm + gapY);

    const labelCard = document.createElement('div');
    labelCard.className = 'absolute bg-white shadow-md rounded-sm overflow-hidden border border-slate-200 select-none';
    labelCard.style.left = `${x_mm}mm`;
    labelCard.style.top = `${y_mm}mm`;
    labelCard.style.width = `${labelW_mm}mm`;
    labelCard.style.height = `${labelH_mm}mm`;

    // Renderizar imagen de fondo si hay ranura activa
    const activeSlotIdx = activeGenTemplate.slot_activo || 0;
    const activeSlot = (activeGenTemplate.slots_fondo || [])[activeSlotIdx];
    if (activeSlot && activeSlot.url) {
      labelCard.style.backgroundImage = `url('${activeSlot.url}')`;
      labelCard.style.backgroundSize = '100% 100%';
      labelCard.style.backgroundPosition = 'center';
    }

    // Renderizar elementos mapeados
    const elementos = activeGenTemplate.elementos || {};
    const habilitados = activeGenTemplate.campos_habilitados || [];

    FIELD_DEFINITIONS.forEach(f => {
      if (!habilitados.includes(f.id)) return;
      const elem = elementos[f.id];
      if (!elem) return;

      const elDiv = document.createElement('div');
      elDiv.className = 'absolute select-none pointer-events-none';
      
      // Posición porcentual y Anclaje dinámico (Alineación + Transform Origin)
      const align = elem.alineacion || 'left';
      elDiv.style.left = `${elem.x || 0}%`;
      elDiv.style.top = `${elem.y || 0}%`;
      elDiv.style.textAlign = align;

      if (align === 'center') {
        elDiv.style.transform = 'translateX(-50%)';
      } else if (align === 'right') {
        elDiv.style.transform = 'translateX(-100%)';
      } else {
        elDiv.style.transform = 'translateX(0%)';
      }

      // Tipografía y Estilos consistentes con editor de plantillas
      const fontFam = (elem.fuente || 'Inter').replace(/['"]/g, '');
      elDiv.style.fontFamily = `'${fontFam}', sans-serif`;
      elDiv.style.fontSize = `${elem.tamano || 16}px`;
      elDiv.style.lineHeight = '1.15';
      elDiv.style.whiteSpace = 'nowrap';
      elDiv.style.color = elem.color || '#000000';
      elDiv.style.fontWeight = elem.bold ? 'bold' : 'normal';
      elDiv.style.fontStyle = elem.italic ? 'italic' : 'normal';
      elDiv.style.letterSpacing = `${elem.espaciado || 0}px`;

      // Stroke / Borde de Texto (Exterior Puro via paint-order y perimetro 8-puntos)
      if (elem.stroke_activo) {
        const strokePx = (elem.stroke_width !== undefined ? elem.stroke_width : 1.0);
        const strokeCol = elem.stroke_color || '#000000';
        elDiv.style.paintOrder = 'stroke fill';
        elDiv.style.webkitTextStroke = `${strokePx * 2}px ${strokeCol}`;

        const s = strokePx;
        const shadows = [
          `${s}px 0 0 ${strokeCol}`,
          `-${s}px 0 0 ${strokeCol}`,
          `0 ${s}px 0 ${strokeCol}`,
          `0 -${s}px 0 ${strokeCol}`,
          `${s * 0.7}px ${s * 0.7}px 0 ${strokeCol}`,
          `-${s * 0.7}px ${s * 0.7}px 0 ${strokeCol}`,
          `${s * 0.7}px -${s * 0.7}px 0 ${strokeCol}`,
          `-${s * 0.7}px -${s * 0.7}px 0 ${strokeCol}`
        ].join(', ');
        elDiv.style.textShadow = shadows;
      } else {
        elDiv.style.paintOrder = 'normal';
        elDiv.style.webkitTextStroke = '';
        elDiv.style.textShadow = '';
      }

      elDiv.textContent = getGenElementValue(f.id, prod);
      labelCard.appendChild(elDiv);
    });

    container.appendChild(labelCard);
  }

  // Renderizar Guías de Corte completas si está activo el interruptor
  if (includeGuiaCorte) {
    renderGuiaCorteLines(container, cols, rows, mLeft, mTop, labelW_mm, labelH_mm, gapX, gapY);
  }
}

// Obtener valor formateado para el generador de pliegos
function getGenElementValue(fieldId, p) {
  if (!p) return '';
  switch (fieldId) {
    case 'title': return p.title || p.Title || 'Sin Título';
    case 'spec_1': return p.spec_1 || p.Spec1 || '';
    case 'spec_2': return p.spec_2 || p.Spec2 || '';
    case 'spec_3': return p.spec_3 || p.Spec3 || '';
    case 'spec_4': return p.spec_4 || p.Spec4 || '';
    case 'spec_5': return p.spec_5 || p.Spec5 || '';
    case 'moneda': return p.moneda || p.Moneda || '$';
    case 'publico_entero': {
      const price = parseFloat(p.publico ?? p.PUBLICO ?? 0) || 0;
      return Math.floor(price).toString();
    }
    case 'publico_decimal': {
      const price = parseFloat(p.publico ?? p.PUBLICO ?? 0) || 0;
      const dec = Math.round((price - Math.floor(price)) * 100);
      return dec.toString().padStart(2, '0');
    }
    case 'cod_1': return p.cod_1 || p.codigo || '';
    case 'cod_2': return p.cod_2 || p.pn || p.PN || '';
    case 'distribuidor': {
      const dist = p.distribuidor ?? p.DISTRIBUIDOR ?? 0;
      return Number(dist).toFixed(2);
    }
    default: return '';
  }
}

function renderGeneradorPagePreview() {
  const container = document.getElementById('gen-sheet-content');
  const emptyState = document.getElementById('gen-empty-state');
  if (!container || !emptyState) return;

  fitGenSheetToViewport();

  // Si no hay plantilla o batch seleccionado
  let totalLabels = 0;
  selectedBatch.forEach(qty => totalLabels += qty);

  if (!activeGenTemplate || totalLabels === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  renderA4SheetPageContent(container, currentPageIndex);
}

// Renderizar marcas y líneas de corte vectoriales completas de borde a borde A4
function renderGuiaCorteLines(container, cols, rows, mLeft, mTop, labelW_mm, labelH_mm, gapX, gapY) {
  const cConfig = getActiveCorteConfig();
  const lineStyle = `${cConfig.corte_grosor}px ${cConfig.corte_tipo} ${cConfig.corte_color}`;

  // Líneas Horizontales (de borde a borde de la hoja A4: X = 0 a X = 210mm)
  if (cConfig.corte_h_activo) {
    const yPositions = [];
    const gridH_mm = rows * labelH_mm + (rows - 1) * gapY;

    if (cConfig.corte_h_modo === 'centro') {
      for (let r = 1; r < rows; r++) {
        yPositions.push(mTop + r * labelH_mm + (r - 0.5) * gapY);
      }
      const topProj = mTop - gapY / 2;
      if (topProj >= 0) yPositions.push(topProj);

      const bottomProj = mTop + gridH_mm + gapY / 2;
      if (bottomProj <= 297) yPositions.push(bottomProj);
    } else {
      // Modo 'pegadas': 2 líneas en cada separación (bordes superior e inferior de cada etiqueta)
      for (let r = 0; r < rows; r++) {
        yPositions.push(mTop + r * (labelH_mm + gapY));
        yPositions.push(mTop + r * (labelH_mm + gapY) + labelH_mm);
      }
    }

    const uniqueY = Array.from(new Set(yPositions.map(y => Math.round(y * 100) / 100)));
    uniqueY.forEach(yMm => {
      const hLine = document.createElement('div');
      hLine.className = 'absolute pointer-events-none';
      hLine.style.left = '0px';
      hLine.style.top = `${yMm}mm`;
      hLine.style.width = '210mm';
      hLine.style.height = '0px';
      hLine.style.borderTop = lineStyle;
      container.appendChild(hLine);
    });
  }

  // Líneas Verticales (de borde a borde de la hoja A4: Y = 0 a Y = 297mm)
  if (cConfig.corte_v_activo) {
    const xPositions = [];
    const gridW_mm = cols * labelW_mm + (cols - 1) * gapX;

    if (cConfig.corte_v_modo === 'centro') {
      for (let c = 1; c < cols; c++) {
        xPositions.push(mLeft + c * labelW_mm + (c - 0.5) * gapX);
      }
      const leftProj = mLeft - gapX / 2;
      if (leftProj >= 0) xPositions.push(leftProj);

      const rightProj = mLeft + gridW_mm + gapX / 2;
      if (rightProj <= 210) xPositions.push(rightProj);
    } else {
      // Modo 'pegadas': 2 líneas en cada separación (bordes izquierdo y derecho de cada etiqueta)
      for (let c = 0; c < cols; c++) {
        xPositions.push(mLeft + c * (labelW_mm + gapX));
        xPositions.push(mLeft + c * (labelW_mm + gapX) + labelW_mm);
      }
    }

    const uniqueX = Array.from(new Set(xPositions.map(x => Math.round(x * 100) / 100)));
    uniqueX.forEach(xMm => {
      const vLine = document.createElement('div');
      vLine.className = 'absolute pointer-events-none';
      vLine.style.left = `${xMm}mm`;
      vLine.style.top = '0px';
      vLine.style.width = '0px';
      vLine.style.height = '297mm';
      vLine.style.borderLeft = lineStyle;
      container.appendChild(vLine);
    });
  }
}

// =========================================================================
// EMISIÓN Y GENERACIÓN DE ARCHIVOS DE IMPRESIÓN (PDF / PRINT NATIVO 300 DPI)
// =========================================================================

function exportarPDF() {
  try {
    if (!activeGenTemplate) {
      alert('Por favor selecciona una plantilla de etiqueta primero.');
      return;
    }

    let totalLabels = 0;
    selectedBatch.forEach(qty => totalLabels += qty);

    if (totalLabels === 0) {
      alert('Por favor selecciona al menos un producto con copias para generar el pliego.');
      return;
    }

    const dims = getTemplateMmDimensions(activeGenTemplate);
    const { cols, rows, mTop, mLeft, gapX, gapY, labelW_mm, labelH_mm, m } = dims;
    const capacidad = cols * rows;

    // Construir lista plana de todas las etiquetas
    const flatItemsList = [];
    selectedBatch.forEach((qty, prodId) => {
      const prod = allGenProducts.find(p => p.id == prodId);
      if (prod) {
        for (let i = 0; i < qty; i++) {
          flatItemsList.push(prod);
        }
      }
    });

    // Definición de fuentes personalizadas instaladas
    let customFontFaceStyles = '';
    const fontsList = window.customInstalledFonts || [];
    if (Array.isArray(fontsList)) {
      fontsList.forEach(cf => {
        if (cf.nombre_familia && cf.ruta) {
          customFontFaceStyles += `
            @font-face {
              font-family: '${cf.nombre_familia}';
              src: url('${cf.ruta}') format('truetype');
            }
          `;
        }
      });
    }

    // Definiciones de campos seguras
    const fieldDefs = (typeof FIELD_DEFINITIONS !== 'undefined' && Array.isArray(FIELD_DEFINITIONS))
      ? FIELD_DEFINITIONS
      : (window.FIELD_DEFINITIONS || [
          { id: 'codigo', label: 'Código' },
          { id: 'nombre', label: 'Nombre' },
          { id: 'descripcion', label: 'Descripción' },
          { id: 'unidad_medida', label: 'Unidad de Medida' },
          { id: 'precio_final', label: 'Precio Final' },
          { id: 'precio_fraccionado', label: 'Precio Fraccionado' },
          { id: 'unidad_fraccionada', label: 'Unidad Fraccionada' },
          { id: 'fecha_actual', label: 'Fecha Actual' }
        ]);

    const totalPages = Math.ceil(flatItemsList.length / capacidad);
    let pagesHtml = '';

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pageItems = flatItemsList.slice(pIdx * capacidad, (pIdx + 1) * capacidad);
      let itemsHtml = '';

      for (let idx = 0; idx < pageItems.length; idx++) {
        const prod = pageItems[idx];
        const r = Math.floor(idx / cols);
        const c = idx % cols;

        const x_mm = mLeft + c * (labelW_mm + gapX);
        const y_mm = mTop + r * (labelH_mm + gapY);

        const activeSlotIdx = (activeGenTemplate.slot_activo !== undefined && activeGenTemplate.slot_activo >= 0) ? activeGenTemplate.slot_activo : 0;
        const activeSlot = (activeGenTemplate.slots_fondo || [])[activeSlotIdx];
        let bgUrl = (activeSlot && activeSlot.url) ? activeSlot.url : '';
        if (bgUrl && !bgUrl.startsWith('data:') && !bgUrl.startsWith('http://') && !bgUrl.startsWith('https://')) {
          if (!bgUrl.startsWith('/')) {
            bgUrl = '/' + bgUrl;
          }
        }

        let bgImgHtml = '';
        if (bgUrl) {
          bgImgHtml = `<img class="label-bg-img" src="${bgUrl}" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: fill; z-index: 1; pointer-events: none; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;" alt="" />`;
        }

        let elementsHtml = '';
        const elementos = activeGenTemplate.elementos || {};
        const habilitados = activeGenTemplate.campos_habilitados || [];

        fieldDefs.forEach(f => {
          if (!habilitados.includes(f.id)) return;
          const elem = elementos[f.id];
          if (!elem) return;

          const val = getGenElementValue(f.id, prod);
          const align = elem.alineacion || 'left';

          let transformCss = 'transform: translateX(0%);';
          if (align === 'center') {
            transformCss = 'transform: translateX(-50%);';
          } else if (align === 'right') {
            transformCss = 'transform: translateX(-100%);';
          }

          let strokeCss = '';
          if (elem.stroke_activo) {
            const strokePx = (elem.stroke_width !== undefined ? elem.stroke_width : 1.0);
            const strokeCol = elem.stroke_color || '#000000';
            const s = strokePx;
            const shadows = [
              `${s}px 0 0 ${strokeCol}`,
              `-${s}px 0 0 ${strokeCol}`,
              `0 ${s}px 0 ${strokeCol}`,
              `0 -${s}px 0 ${strokeCol}`,
              `${s * 0.7}px ${s * 0.7}px 0 ${strokeCol}`,
              `-${s * 0.7}px ${s * 0.7}px 0 ${strokeCol}`,
              `${s * 0.7}px -${s * 0.7}px 0 ${strokeCol}`,
              `-${s * 0.7}px -${s * 0.7}px 0 ${strokeCol}`
            ].join(', ');
            strokeCss = `paint-order: stroke fill; -webkit-text-stroke: ${strokePx * 2}px ${strokeCol}; text-shadow: ${shadows};`;
          }

          const fontFam = (elem.fuente || 'Inter').replace(/['"]/g, '');

          elementsHtml += `
            <div style="position: absolute; left: ${elem.x || 0}%; top: ${elem.y || 0}%; ${transformCss} font-family: '${fontFam}', sans-serif; font-size: ${elem.tamano || 16}px; line-height: 1.15; white-space: nowrap; color: ${elem.color || '#000000'}; font-weight: ${elem.bold ? 'bold' : 'normal'}; font-style: ${elem.italic ? 'italic' : 'normal'}; text-align: ${align}; letter-spacing: ${elem.espaciado || 0}px; ${strokeCss}">
              ${val}
            </div>
          `;
        });

        itemsHtml += `
          <div style="position: absolute; left: ${x_mm}mm; top: ${y_mm}mm; width: ${labelW_mm}mm; height: ${labelH_mm}mm; box-sizing: border-box; overflow: hidden;">
            ${bgImgHtml}
            <div style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none;">
              ${elementsHtml}
            </div>
          </div>
        `;
      }

      // Guías de corte completas para impresión vectorial
      let cutLinesHtml = '';
      if (includeGuiaCorte) {
        const cConfig = getActiveCorteConfig();
        const lineStyle = `${cConfig.corte_grosor}px ${cConfig.corte_tipo} ${cConfig.corte_color}`;

        if (cConfig.corte_h_activo) {
          const yPositions = [];
          const gridH_mm = rows * labelH_mm + (rows - 1) * gapY;

          if (cConfig.corte_h_modo === 'centro') {
            for (let r = 1; r < rows; r++) {
              yPositions.push(mTop + r * labelH_mm + (r - 0.5) * gapY);
            }
            const topProj = mTop - gapY / 2;
            if (topProj >= 0) yPositions.push(topProj);

            const bottomProj = mTop + gridH_mm + gapY / 2;
            if (bottomProj <= 297) yPositions.push(bottomProj);
          } else {
            // Modo 'pegadas'
            for (let r = 0; r < rows; r++) {
              yPositions.push(mTop + r * (labelH_mm + gapY));
              yPositions.push(mTop + r * (labelH_mm + gapY) + labelH_mm);
            }
          }

          const uniqueY = Array.from(new Set(yPositions.map(y => Math.round(y * 100) / 100)));
          uniqueY.forEach(yMm => {
            cutLinesHtml += `<div style="position: absolute; left: 0px; top: ${yMm}mm; width: 210mm; height: 0px; border-top: ${lineStyle};"></div>`;
          });
        }

        if (cConfig.corte_v_activo) {
          const xPositions = [];
          const gridW_mm = cols * labelW_mm + (cols - 1) * gapX;

          if (cConfig.corte_v_modo === 'centro') {
            for (let c = 1; c < cols; c++) {
              xPositions.push(mLeft + c * labelW_mm + (c - 0.5) * gapX);
            }
            const leftProj = mLeft - gapX / 2;
            if (leftProj >= 0) xPositions.push(leftProj);

            const rightProj = mLeft + gridW_mm + gapX / 2;
            if (rightProj <= 210) xPositions.push(rightProj);
          } else {
            // Modo 'pegadas'
            for (let c = 0; c < cols; c++) {
              xPositions.push(mLeft + c * (labelW_mm + gapX));
              xPositions.push(mLeft + c * (labelW_mm + gapX) + labelW_mm);
            }
          }

          const uniqueX = Array.from(new Set(xPositions.map(x => Math.round(x * 100) / 100)));
          uniqueX.forEach(xMm => {
            cutLinesHtml += `<div style="position: absolute; left: ${xMm}mm; top: 0px; width: 0px; height: 297mm; border-left: ${lineStyle};"></div>`;
          });
        }
      }

      pagesHtml += `
        <div class="page-a4">
          ${itemsHtml}
          ${cutLinesHtml}
        </div>
      `;
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <base href="${window.location.origin}/">
  <title>Pliego A4 - ${activeGenTemplate.nombre || 'Etiquetas'}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Inter:wght@300;400;500;600;700;800;900&family=Montserrat:wght@400;600;700;800;900&family=Oswald:wght@400;500;600;700&family=Outfit:wght@400;600;700;800&family=Roboto:wght@400;500;700;900&family=Roboto+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #475569;
    }
    ${customFontFaceStyles}
    .page-a4 {
      width: 210mm;
      height: 297mm;
      position: relative;
      margin: 20px auto;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      page-break-after: always;
      overflow: hidden;
      background: #ffffff;
    }
    .page-a4:last-child {
      page-break-after: avoid;
    }
    @media print {
      html, body {
        background: #ffffff !important;
      }
      .page-a4 {
        margin: 0 !important;
        box-shadow: none !important;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- Barra Flotante de Acciones (Oculta al imprimir) -->
  <div class="no-print" style="position: fixed; top: 14px; right: 18px; z-index: 999999; display: flex; gap: 10px; background: rgba(15,23,42,0.92); backdrop-filter: blur(8px); padding: 8px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 10px 25px rgba(0,0,0,0.35); font-family: sans-serif;">
    <button onclick="window.print()" style="background: #10b981; color: white; border: none; padding: 9px 18px; border-radius: 8px; font-weight: bold; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(16,185,129,0.35);">
      🖨️ Imprimir / Guardar como PDF
    </button>
    <button onclick="window.close()" style="background: #334155; color: #cbd5e1; border: none; padding: 9px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer;">
      Cerrar
    </button>
  </div>

  ${pagesHtml}

  <script>
    async function startPrint() {
      const imgs = Array.from(document.querySelectorAll('img.label-bg-img'));
      await Promise.all(imgs.map(img => {
        if (img.complete) {
          if (typeof img.decode === 'function') {
            return img.decode().catch(() => {});
          }
          return Promise.resolve();
        }
        return new Promise(resolve => {
          img.onload = () => {
            if (typeof img.decode === 'function') {
              img.decode().then(resolve).catch(resolve);
            } else {
              resolve();
            }
          };
          img.onerror = resolve;
        });
      }));
      setTimeout(() => {
        window.focus();
        window.print();
      }, 400);
    }
    if (document.readyState === 'complete') {
      startPrint();
    } else {
      window.addEventListener('load', startPrint);
    }
  <\/script>
</body>
</html>`;

    // Generar via Blob URL nativo (garantiza renderizado inmediato sin pestaña en blanco)
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const printWin = window.open(blobUrl, '_blank');
    if (!printWin) {
      alert('Por favor permite las ventanas emergentes (pop-ups) en tu navegador para ver el pliego e imprimir.');
      return;
    }
  } catch (err) {
    console.error('Error en exportarPDF:', err);
    alert('Ocurrió un error al preparar el pliego para imprimir: ' + (err.message || err));
  }
}