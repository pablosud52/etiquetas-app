// =========================================================================
// MÓDULO 3: GESTIÓN DE PRODUCTOS Y LISTA DE PRECIOS
// Archivo: public/js/datos.js
// Responsabilidad: Importación completa de Excel (todas las filas, incluidas
//                  las de valor cero), renderizado de tabla con ETIQUETA TAMAÑO,
//                  vaciado sincrónico con reset completo de UI.
// =========================================================================

/** Cache local de todos los productos cargados desde SQLite */
let allProductsCache = [];

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN DEL MÓDULO
// ─────────────────────────────────────────────────────────────────────────────

async function initDatosModule() {
  populateDiasGraciaSelector();
  await Promise.all([
    loadObsolescenciaStatus(),
    loadProducts()
  ]);
}

// Generar opciones del selector de días de obsolescencia: 5, 10, 15, 20, 25, 30 días
function populateDiasGraciaSelector() {
  const select = document.getElementById('select-dias-gracia');
  if (!select) return;

  select.innerHTML = '';
  [5, 10, 15, 20, 25, 30].forEach(dias => {
    const opt = document.createElement('option');
    opt.value = dias;
    opt.textContent = `${dias} días`;
    select.appendChild(opt);
  });
  select.value = '5';
}

// Cargar estado de obsolescencia y metadatos de la lista actual
async function loadObsolescenciaStatus() {
  try {
    const res = await fetch('/api/config/obsolescencia');
    if (!res.ok) throw new Error('No se pudo obtener el estado de obsolescencia');

    const data = await res.json();
    if (!data.success) return;

    const select = document.getElementById('select-dias-gracia');
    if (select && data.dias_gracia) {
      select.value = String(data.dias_gracia);
    }

    const filenameEl = document.getElementById('active-filename-display');
    const filedateEl = document.getElementById('active-filedate-display');
    if (filenameEl) {
      filenameEl.textContent = data.nombre_archivo || 'Ninguno';
      filenameEl.title = data.nombre_archivo || '';
    }
    if (filedateEl) {
      if (data.fecha_ultima_carga) {
        const d = new Date(data.fecha_ultima_carga);
        filedateEl.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        filedateEl.textContent = 'Nunca';
      }
    }

    const badgeEl = document.getElementById('obsolescencia-badge');
    const diasEl = document.getElementById('dias-transcurridos-display');
    const msgEl = document.getElementById('obsolescencia-msg-display');

    if (diasEl) {
      diasEl.textContent = data.dias_transcurridos !== null ? `${data.dias_transcurridos} día(s)` : 'Sin registro';
    }

    if (msgEl) {
      msgEl.textContent = data.mensaje;
    }

    if (badgeEl) {
      if (data.esta_obsoleto) {
        badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse';
        badgeEl.textContent = 'Desactualizado';
      } else {
        badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
        badgeEl.textContent = 'Vigente';
      }
    }

  } catch (err) {
    console.error('Error al cargar obsolescencia:', err);
  }
}

// Guardar configuración de días de obsolescencia
async function saveObsolescenciaConfig() {
  const select = document.getElementById('select-dias-gracia');
  if (!select) return;

  const dias = parseInt(select.value, 10) || 5;
  try {
    const res = await fetch('/api/config/obsolescencia', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dias_gracia: dias })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al guardar');

    alert(`✅ Configuración guardada: Alerta configurada a ${dias} días.`);
    await loadObsolescenciaStatus();
    select.value = String(dias);
  } catch (err) {
    alert('Error al actualizar tiempo de obsolescencia: ' + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGAR PRODUCTOS — GET /api/products
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene la lista completa de productos desde SQLite via /api/products,
 * actualiza el contador dinámico y renderiza la tabla HTML.
 */
async function loadProducts() {
  const tbody = document.getElementById('datos-table-body');
  if (!tbody) return;

  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener lista de productos`);

    const products = await res.json();

    // Guardar en cache local
    allProductsCache = Array.isArray(products) ? products : [];

    // Actualizar contador dinámico con el total devuelto por la API
    _updateProductCounter(allProductsCache.length);

    // Renderizar tabla
    renderProductsTable(allProductsCache);

  } catch (err) {
    console.error('Error al cargar productos:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="px-6 py-6 text-center text-red-400">
            Error al obtener lista de productos: ${err.message}
          </td>
        </tr>`;
    }
  }
}

/** Alias de compatibilidad */
async function loadProductsList() {
  await loadProducts();
}

/** Actualiza el elemento de contador con el total actual */
function _updateProductCounter(total) {
  const countInfo = document.getElementById('datos-count-info');
  if (countInfo) {
    countInfo.textContent = `Total: ${total} producto${total !== 1 ? 's' : ''}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZAR TABLA DE PRODUCTOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza el arreglo de productos en la tabla HTML.
 * Incluye el valor real de la columna ETIQUETA TAMAÑO (etiqueta_tamano).
 * @param {Array} products
 */
function renderProductsTable(products) {
  const tbody = document.getElementById('datos-table-body');
  if (!tbody) return;

  // Actualizar contador con el total mostrado actualmente
  _updateProductCounter(products.length);

  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-6 py-8 text-center text-slate-500">No hay productos registrados en la lista. Sube un archivo Excel para comenzar.</td>
      </tr>`;
    return;
  }

  products.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-700/30 transition-colors border-b border-slate-700/40';

    const publicoFormatted = p.publico != null ? Number(p.publico).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const distribFormatted = p.distribuidor != null ? Number(p.distribuidor).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

    const specs = [p.spec_1, p.spec_2, p.spec_3, p.spec_4, p.spec_5].filter(Boolean);
    const specsHtml = specs.length > 0
      ? `<div class="flex flex-col gap-1 py-1">
           ${specs.map(s => `<span class="inline-block bg-slate-900 px-2 py-0.5 rounded text-[11px] text-slate-300 border border-slate-700/60 font-sans">${s}</span>`).join('')}
         </div>`
      : '<span class="text-slate-600">-</span>';

    // Valor real de la columna ETIQUETA TAMAÑO guardado en SQLite como etiqueta_tamano
    const tamanoVal = (p.etiqueta_tamano || p.tamano || p['Tamaño'] || '').trim() || '-';

    tr.innerHTML = `
      <td class="px-4 py-3 font-mono text-slate-300 font-medium">${p.cod_1 || '-'}</td>
      <td class="px-4 py-3 font-mono text-slate-400">${p.cod_2 || '-'}</td>
      <td class="px-4 py-3 font-semibold text-white max-w-xs truncate" title="${p.title || ''}">${p.title || '-'}</td>
      <td class="px-4 py-3 max-w-xs">${specsHtml}</td>
      <td class="px-3 py-3 text-slate-300 font-mono text-center">${p.moneda || '$'}</td>
      <td class="px-4 py-3 text-right font-bold text-emerald-400 font-mono">${publicoFormatted}</td>
      <td class="px-4 py-3 text-right font-bold text-purple-400 font-mono">${distribFormatted}</td>
      <td class="px-4 py-3 text-slate-300 font-mono font-medium">${tamanoVal}</td>
      <td class="px-4 py-3 text-right space-x-2 whitespace-nowrap">
        <button onclick="editProduct(${p.id})" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors cursor-pointer">
          Editar
        </button>
        <button onclick="deleteProduct(${p.id})" class="px-2 py-1 bg-red-900/40 hover:bg-red-800/60 text-red-300 text-xs rounded transition-colors cursor-pointer">
          Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Búsqueda reactiva en tabla de productos
function filterDatosTable() {
  const query = (document.getElementById('datos-search')?.value || '').toLowerCase().trim();
  if (!query) {
    renderProductsTable(allProductsCache);
    return;
  }

  const filtered = allProductsCache.filter(p => {
    const cod1 = (p.cod_1 || '').toLowerCase();
    const cod2 = (p.cod_2 || '').toLowerCase();
    const title = (p.title || '').toLowerCase();
    const specs = `${p.spec_1 || ''} ${p.spec_2 || ''} ${p.spec_3 || ''} ${p.spec_4 || ''} ${p.spec_5 || ''}`.toLowerCase();
    const tamano = (p.etiqueta_tamano || p.tamano || '').toLowerCase();
    return cod1.includes(query) || cod2.includes(query) || title.includes(query) || specs.includes(query) || tamano.includes(query);
  });

  renderProductsTable(filtered);
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTACIÓN DE EXCEL — POST /api/products/import
// ─────────────────────────────────────────────────────────────────────────────

async function importExcel() {
  const fileInput = document.getElementById('excel-file-input');
  if (!fileInput || !fileInput.files[0]) {
    alert('Por favor selecciona un archivo Excel (.xlsx o .xls).');
    return;
  }

  const file              = fileInput.files[0];
  const btn               = document.getElementById('btn-upload-excel');
  const progressContainer = document.getElementById('excel-progress-container');
  const progressBar       = document.getElementById('excel-progress-bar');
  const progressPercent   = document.getElementById('excel-progress-percent');
  const progressStatus    = document.getElementById('excel-progress-status-text');

  if (btn) btn.disabled = true;
  if (progressContainer) progressContainer.classList.remove('hidden');

  let currentPercent = 10;
  const updateProgress = (pct, msg) => {
    currentPercent = pct;
    if (progressBar)     progressBar.style.width    = `${pct}%`;
    if (progressPercent) progressPercent.textContent = `${pct}%`;
    if (progressStatus && msg) progressStatus.textContent = msg;
  };

  updateProgress(20, 'Leyendo archivo Excel...');

  const formData = new FormData();
  formData.append('excel', file);

  try {
    const progressInterval = setInterval(() => {
      if (currentPercent < 85) {
        updateProgress(currentPercent + 15, 'Procesando productos e insertando...');
      }
    }, 250);

    // Enviar al endpoint unificado POST /api/products/import
    const res = await fetch('/api/products/import', {
      method: 'POST',
      body: formData
    });

    clearInterval(progressInterval);

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Error al procesar el archivo Excel');

    updateProgress(100, '¡Lista de productos importada con éxito!');

    setTimeout(async () => {
      alert(`✅ ${data.message || 'Lista de productos actualizada correctamente.'}`);
      fileInput.value = '';
      if (progressContainer) progressContainer.classList.add('hidden');
      updateProgress(0, '');

      await Promise.all([
        loadObsolescenciaStatus(),
        loadProducts()
      ]);
    }, 300);

  } catch (err) {
    if (progressContainer) progressContainer.classList.add('hidden');
    alert('Error al importar Excel: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** Alias para el botón de subida */
async function uploadExcelFile() {
  await importExcel();
}

/** Descarga el archivo Excel activo */
function downloadCurrentExcel() {
  window.location.href = '/api/productos/download-current';
}

/**
 * Elimina únicamente el archivo Excel físico almacenado en el servidor.
 * NO borra el listado de productos en SQLite.
 * Accesible desde el botón "Eliminar archivo" en la tarjeta de importación.
 */
async function deleteExcelFile() {
  if (!confirm('¿Estás seguro de que deseas eliminar el archivo Excel almacenado?\n\nEsta acción borra el molde del servidor, pero NO afecta al listado de productos en la base de datos.')) {
    return;
  }

  const btn = document.getElementById('btn-delete-excel');
  if (btn) btn.disabled = true;

  try {
    const res  = await fetch('/api/products/excel', { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok && res.status !== 404) {
      throw new Error(data.message || 'Error al eliminar el archivo');
    }

    // Actualizar badge de nombre de archivo en la UI
    const filenameEl = document.getElementById('active-filename-display');
    if (filenameEl) {
      filenameEl.textContent = 'Ninguno';
      filenameEl.title       = '';
    }

    alert('✅ Archivo Excel eliminado correctamente.\nEl listado de productos permanece intacto en la base de datos.');

  } catch (err) {
    alert('Error al eliminar el archivo: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VACIAR LISTADO — DELETE /api/products/clear
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vacía completamente el listado de productos:
 * 1. Pide confirmación explícita al usuario (confirm()).
 * 2. Ejecuta DELETE /api/products/clear.
 * 3. Tras respuesta exitosa del servidor: vacía tabla, resetea badges
 *    de "Archivo activo" y "Última carga", y actualiza contador a Total: 0 productos.
 */
async function clearProducts() {
  // 1. Confirmación explícita
  if (!confirm('¿Estás seguro de que deseas vaciar completamente la lista de productos?\nEsta acción eliminará todos los registros en SQLite y no se puede deshacer.')) {
    return;
  }

  const modal          = document.getElementById('datos-progress-modal');
  const progressBar    = document.getElementById('progress-modal-bar');
  const progressPct    = document.getElementById('progress-modal-percent');
  const progressTitle  = document.getElementById('progress-modal-title');
  const progressStatus = document.getElementById('progress-modal-status-text');

  if (modal)         modal.classList.remove('hidden');
  if (progressTitle) progressTitle.textContent = 'Vaciando Listado...';

  let pct = 10;
  const updatePct = (val, text) => {
    pct = val;
    if (progressBar)    progressBar.style.width    = `${val}%`;
    if (progressPct)    progressPct.textContent    = `${val}%`;
    if (progressStatus && text) progressStatus.textContent = text;
  };

  updatePct(30, 'Ejecutando vaciado de tabla en SQLite...');

  try {
    const timer = setInterval(() => {
      if (pct < 85) updatePct(pct + 20, 'Limpiando registros...');
    }, 150);

    // 2. Petición HTTP DELETE — espera confirmación física de eliminación en SQLite
    const res = await fetch('/api/products/clear', { method: 'DELETE' });
    clearInterval(timer);

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error al vaciar el listado');
    }

    updatePct(100, '¡Listado eliminado con éxito!');

    // 3. Tras respuesta exitosa: vaciar estado local y resetear UI completamente
    allProductsCache = [];

    // Resetear badges de "Archivo activo" y "Última carga" a estado vacío
    const filenameEl = document.getElementById('active-filename-display');
    const filedateEl = document.getElementById('active-filedate-display');
    if (filenameEl) {
      filenameEl.textContent = 'Ninguno';
      filenameEl.title       = '';
    }
    if (filedateEl) {
      filedateEl.textContent = 'Nunca';
    }

    // Actualizar contador a Total: 0 productos
    _updateProductCounter(0);

    // Vaciar tabla en pantalla inmediatamente
    renderProductsTable([]);

    if (modal) modal.classList.add('hidden');

    // Resincronizar metadatos de obsolescencia con SQLite
    await loadObsolescenciaStatus();

    alert(`✅ Listado vaciado correctamente. Total: ${data.count ?? 0} productos.`);

  } catch (err) {
    if (modal) modal.classList.add('hidden');
    alert('Error al vaciar el listado: ' + err.message);
  }
}

/** Alias para el botón vaciar listado */
async function confirmClearAllData() {
  await clearProducts();
}

// MODAL CREAR / EDITAR PRODUCTO
function openProductModal(isEdit = false) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('modal-product-title');

  if (!isEdit) {
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-cod-1').value = '';
    document.getElementById('prod-cod-2').value = '';
    document.getElementById('prod-title').value = '';
    document.getElementById('prod-spec-1').value = '';
    document.getElementById('prod-spec-2').value = '';
    document.getElementById('prod-spec-3').value = '';
    document.getElementById('prod-spec-4').value = '';
    document.getElementById('prod-spec-5').value = '';
    document.getElementById('prod-moneda').value = '$';
    document.getElementById('prod-publico').value = '';
    document.getElementById('prod-distrib').value = '';
    document.getElementById('prod-etiqueta-tamano').value = '';
    if (title) title.textContent = 'Nuevo Producto';
  } else {
    if (title) title.textContent = 'Editar Producto';
  }

  if (modal) modal.classList.remove('hidden');
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  if (modal) modal.classList.add('hidden');
}

function editProduct(id) {
  const prod = allProductsCache.find(p => p.id === id);
  if (!prod) return;

  openProductModal(true);
  document.getElementById('prod-id').value = prod.id;
  document.getElementById('prod-cod-1').value = prod.cod_1 || '';
  document.getElementById('prod-cod-2').value = prod.cod_2 || '';
  document.getElementById('prod-title').value = prod.title || '';
  document.getElementById('prod-spec-1').value = prod.spec_1 || '';
  document.getElementById('prod-spec-2').value = prod.spec_2 || '';
  document.getElementById('prod-spec-3').value = prod.spec_3 || '';
  document.getElementById('prod-spec-4').value = prod.spec_4 || '';
  document.getElementById('prod-spec-5').value = prod.spec_5 || '';
  document.getElementById('prod-moneda').value = prod.moneda || '$';
  document.getElementById('prod-publico').value = prod.publico ?? '';
  document.getElementById('prod-distrib').value = prod.distribuidor ?? '';
  document.getElementById('prod-etiqueta-tamano').value = prod.etiqueta_tamano || prod.tamano || '';
}

async function handleProductSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('prod-id').value;
  const payload = {
    cod_1: document.getElementById('prod-cod-1').value.trim(),
    cod_2: document.getElementById('prod-cod-2').value.trim(),
    title: document.getElementById('prod-title').value.trim(),
    spec_1: document.getElementById('prod-spec-1').value.trim(),
    spec_2: document.getElementById('prod-spec-2').value.trim(),
    spec_3: document.getElementById('prod-spec-3').value.trim(),
    spec_4: document.getElementById('prod-spec-4').value.trim(),
    spec_5: document.getElementById('prod-spec-5').value.trim(),
    moneda: document.getElementById('prod-moneda').value.trim() || '$',
    publico: parseFloat(document.getElementById('prod-publico').value) || 0,
    distribuidor: parseFloat(document.getElementById('prod-distrib').value) || 0,
    etiqueta_tamano: document.getElementById('prod-etiqueta-tamano').value.trim()
  };

  const url = id ? `/api/products/${id}` : '/api/products';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Error al guardar producto');

    closeProductModal();
    await loadProducts();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteProduct(id) {
  if (!confirm('¿Estás seguro de eliminar este producto del listado?')) return;

  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al eliminar');

    await loadProducts();
  } catch (err) {
    alert(err.message);
  }
}

// Exponer funciones en window
window.initDatosModule = initDatosModule;
window.populateDiasGraciaSelector = populateDiasGraciaSelector;
window.loadObsolescenciaStatus = loadObsolescenciaStatus;
window.saveObsolescenciaConfig = saveObsolescenciaConfig;
window.loadProducts = loadProducts;
window.loadProductsList = loadProductsList;
window.renderProductsTable = renderProductsTable;
window.filterDatosTable = filterDatosTable;
window.importExcel = importExcel;
window.uploadExcelFile = uploadExcelFile;
window.downloadCurrentExcel = downloadCurrentExcel;
window.deleteExcelFile       = deleteExcelFile;
window.clearProducts = clearProducts;
window.confirmClearAllData = confirmClearAllData;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.editProduct = editProduct;
window.handleProductSubmit = handleProductSubmit;
window.deleteProduct = deleteProduct;