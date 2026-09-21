// =========================================================================
// MÓDULO 2 - EDITOR DE PLANTILLAS: IMPOSICIÓN A4 Y ESTRUCTURA FÍSICA
// Archivo: public/js/editor-imposicion.js
// Responsabilidad: Pestaña 1 - Dimensiones unitarias, Grilla A4, Márgenes,
//                  Espaciados (Gap X/Y), Guías de Refilado/Corte y Zoom A4.
// =========================================================================

let tab1Zoom = 1.0;
// Base fija para la hoja A4 en Tab 1: 580px * 1.30 = 754px (el 130% es ahora el nuevo 100%)
const TAB1_BASE_SHEET_HEIGHT = 754;

function initTab1BaseSize() {
  // Mantiene compatibilidad con llamadas existentes.
  // La altura base 754px es estable y consistente entre cambios de sección y pestañas.
}

function adjustTab1Zoom(delta) {
  tab1Zoom = Math.max(0.3, Math.min(3.0, parseFloat((tab1Zoom + delta).toFixed(2))));
  updateTab1ZoomDisplay();
  applyTab1ZoomTransform();
}

function resetTab1Zoom() {
  tab1Zoom = 1.0;
  updateTab1ZoomDisplay();
  applyTab1ZoomTransform();
}

function applyTab1ZoomTransform() {
  const sheet = document.getElementById('tab1-a4-preview-sheet');
  if (sheet) {
    sheet.style.transform = `scale(${tab1Zoom})`;
    sheet.style.transformOrigin = 'center top';
    const currentH = parseFloat(sheet.style.height) || TAB1_BASE_SHEET_HEIGHT;
    sheet.style.marginBottom = tab1Zoom > 1.0 ? `${(currentH * tab1Zoom) - currentH}px` : '0px';
  }
}

function updateTab1ZoomDisplay() {
  const disp = document.getElementById('tab1-zoom-level-display');
  if (disp) disp.textContent = `${Math.round(tab1Zoom * 100)}%`;
}

// Actualizar dimensiones unitarias de la etiqueta
function updateLabelDimensions() {
  if (!currentTemplate) return;
  pushHistoryState();

  let ancho = parseFloat(document.getElementById('tpl-ancho')?.value) || 10.0;
  let alto = parseFloat(document.getElementById('tpl-alto')?.value) || 5.0;

  if (ancho > 30) ancho /= 10;
  if (alto > 30) alto /= 10;

  currentTemplate.ancho = parseFloat(ancho.toFixed(1));
  currentTemplate.alto = parseFloat(alto.toFixed(1));

  const dimBadge = document.getElementById('canvas-dimension-badge');
  if (dimBadge) {
    dimBadge.textContent = `${currentTemplate.ancho.toFixed(1)}cm x ${currentTemplate.alto.toFixed(1)}cm`;
  }

  // Renderizar pliego A4 Tab 1 y refrescar lienzo 2D Tab 2 si está disponible
  renderMatrizA4Tab1();
  if (typeof renderCanvas === 'function') {
    renderCanvas();
  }
}

// Actualizar categoría/tamaño de etiqueta para filtrado de catálogo
function updateTemplateEtiquetaTamano(val) {
  if (!currentTemplate) return;
  pushHistoryState();
  currentTemplate.etiqueta_tamano = (val || '').trim() || 'Personalizado';
  if (typeof filterEditorProductsTable === 'function') {
    filterEditorProductsTable();
  }
}

// Guardar explícitamente la configuración de la Matriz A4 y persistir en la base de datos
async function saveMatrizA4Config() {
  if (!currentTemplate) return;
  pushHistoryState();

  if (typeof syncTemplateFromUI === 'function') {
    syncTemplateFromUI();
  } else {
    const cols = parseInt(document.getElementById('tpl-matriz-cols')?.value, 10) || 2;
    const rows = parseInt(document.getElementById('tpl-matriz-rows')?.value, 10) || 4;
    let mTopRaw = parseFloat(String(document.getElementById('tpl-matriz-margin-top')?.value).replace(',', '.'));
    let mLeftRaw = parseFloat(String(document.getElementById('tpl-matriz-margin-left')?.value).replace(',', '.'));
    let gapXRaw = parseFloat(String(document.getElementById('tpl-matriz-gap-x')?.value).replace(',', '.'));
    let gapYRaw = parseFloat(String(document.getElementById('tpl-matriz-gap-y')?.value).replace(',', '.'));
    let mTop = isNaN(mTopRaw) ? 1.0 : mTopRaw;
    let mLeft = isNaN(mLeftRaw) ? 1.0 : mLeftRaw;
    let gapX = isNaN(gapXRaw) ? 0.0 : gapXRaw;
    let gapY = isNaN(gapYRaw) ? 0.0 : gapYRaw;
    if (mTop > 5) mTop /= 10;
    if (mLeft > 5) mLeft /= 10;
    if (gapX > 3) gapX /= 10;
    if (gapY > 3) gapY /= 10;

    const corteTipo = document.getElementById('tpl-matriz-corte-tipo')?.value || 'solid';
    const corteGrosor = parseInt(document.getElementById('tpl-matriz-corte-grosor')?.value, 10) || 1;
    const corteColor = document.getElementById('tpl-matriz-corte-color')?.value || '#94a3b8';

    const corteHActivo = document.getElementById('tpl-matriz-corte-h-activo') ? document.getElementById('tpl-matriz-corte-h-activo').checked : true;
    const corteHModo = document.getElementById('tpl-matriz-corte-h-modo')?.value || 'pegadas';

    const corteVActivo = document.getElementById('tpl-matriz-corte-v-activo') ? document.getElementById('tpl-matriz-corte-v-activo').checked : true;
    const corteVModo = document.getElementById('tpl-matriz-corte-v-modo')?.value || 'pegadas';

    currentTemplate.matriz_a4 = {
      columnas: cols,
      filas: rows,
      margin_top: mTop,
      margin_left: mLeft,
      gap_x: gapX,
      gap_y: gapY,
      corte_tipo: corteTipo,
      corte_grosor: corteGrosor,
      corte_color: corteColor,
      corte_h_activo: corteHActivo,
      corte_h_modo: corteHModo,
      corte_v_activo: corteVActivo,
      corte_v_modo: corteVModo
    };
  }

  renderMatrizA4Tab1();

  if (typeof saveTemplate === 'function') {
    await saveTemplate();
  } else {
    alert('✅ Configuración geométrica de Matriz A4 guardada correctamente.');
  }
}

// Helper para replegar/desplegar todas las secciones de la pestaña Estructura A4
function toggleAllTab1Accordions(expand) {
  ['tab1-matriz', 'tab1-corte'].forEach(id => {
    const content = document.getElementById(`content-${id}`);
    const arrow = document.getElementById(`arrow-${id}`);
    if (content) {
      if (expand) {
        content.classList.remove('hidden');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
      } else {
        content.classList.add('hidden');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
      }
    }
  });
}

// Helper genérico para renderizar líneas de guillotinado con estricta exclusividad mutua y extensión completa (de margen a margen A4)
function renderCutLinesHelper(container, p) {
  const lineStyle = `${p.corteGrosor}px ${p.corteTipo} ${p.corteColor}`;
  
  const gridW_cm = p.cols * p.labelW_cm + (p.cols - 1) * p.gapX;
  const gridH_cm = p.rows * p.labelH_cm + (p.rows - 1) * p.gapY;

  // LÍNEAS HORIZONTALES DE CORTE (Extensión completa de borde a borde X = 0 a X = 21.0 cm)
  if (p.corteHActivo) {
    const yPositions = [];

    if (p.corteHModo === 'centro') {
      // Modo 'centro': 1 única línea en el centro de cada separación (Gap / 2)
      for (let r = 1; r < p.rows; r++) {
        yPositions.push(p.mTop + r * p.labelH_cm + (r - 0.5) * p.gapY);
      }
      // Proyección exterior única a distancia Gap / 2 desde los bordes externos de la grilla
      const topProj = p.mTop - p.gapY / 2;
      if (topProj >= 0) yPositions.push(topProj);

      const bottomProj = p.mTop + gridH_cm + p.gapY / 2;
      yPositions.push(bottomProj);

    } else {
      // Modo 'pegadas': 2 líneas en cada separación (bordes superior e inferior de cada etiqueta)
      for (let r = 0; r < p.rows; r++) {
        yPositions.push(p.mTop + r * (p.labelH_cm + p.gapY)); // Borde superior fila r
        yPositions.push(p.mTop + r * (p.labelH_cm + p.gapY) + p.labelH_cm); // Borde inferior fila r
      }
    }

    const uniqueY = Array.from(new Set(yPositions.map(y => Math.round(y * 1000) / 1000)));

    uniqueY.forEach(yCm => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'absolute pointer-events-none w-full';
      lineDiv.style.left = '0px';
      lineDiv.style.top = `${yCm * p.scale}px`;
      lineDiv.style.height = '0px';
      lineDiv.style.borderTop = lineStyle;
      container.appendChild(lineDiv);
    });
  }

  // LÍNEAS VERTICALES DE CORTE (Extensión completa de borde a borde Y = 0 a Y = 29.7 cm)
  if (p.corteVActivo) {
    const xPositions = [];

    if (p.corteVModo === 'centro') {
      // Modo 'centro': 1 única línea en el centro de cada separación (Gap / 2)
      for (let c = 1; c < p.cols; c++) {
        xPositions.push(p.mLeft + c * p.labelW_cm + (c - 0.5) * p.gapX);
      }
      // Proyección exterior única a distancia Gap / 2 desde los bordes externos de la grilla
      const leftProj = p.mLeft - p.gapX / 2;
      if (leftProj >= 0) xPositions.push(leftProj);

      const rightProj = p.mLeft + gridW_cm + p.gapX / 2;
      xPositions.push(rightProj);

    } else {
      // Modo 'pegadas': 2 líneas en cada separación (bordes izquierdo y derecho de cada etiqueta)
      for (let c = 0; c < p.cols; c++) {
        xPositions.push(p.mLeft + c * (p.labelW_cm + p.gapX)); // Borde izquierdo col c
        xPositions.push(p.mLeft + c * (p.labelW_cm + p.gapX) + p.labelW_cm); // Borde derecho col c
      }
    }

    const uniqueX = Array.from(new Set(xPositions.map(x => Math.round(x * 1000) / 1000)));

    uniqueX.forEach(xCm => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'absolute pointer-events-none h-full';
      lineDiv.style.left = `${xCm * p.scale}px`;
      lineDiv.style.top = '0px';
      lineDiv.style.width = '0px';
      lineDiv.style.borderLeft = lineStyle;
      container.appendChild(lineDiv);
    });
  }
}

// Sincronizar parámetros de matriz A4 editados por el usuario hacia currentTemplate y refrescar
function updateMatrizA4FromInputs() {
  if (!currentTemplate) return;
  if (!currentTemplate.matriz_a4 || typeof currentTemplate.matriz_a4 !== 'object') {
    currentTemplate.matriz_a4 = {};
  }
  const m = currentTemplate.matriz_a4;

  const elCols = document.getElementById('tpl-matriz-cols');
  if (elCols && elCols.value !== '') {
    m.columnas = parseInt(elCols.value, 10) || m.columnas || 2;
  }
  const elRows = document.getElementById('tpl-matriz-rows');
  if (elRows && elRows.value !== '') {
    m.filas = parseInt(elRows.value, 10) || m.filas || 4;
  }
  const elMTop = document.getElementById('tpl-matriz-margin-top');
  if (elMTop && elMTop.value !== '') {
    let raw = parseFloat(String(elMTop.value).replace(',', '.'));
    if (!isNaN(raw)) m.margin_top = raw > 5 ? raw / 10 : raw;
  }
  const elMLeft = document.getElementById('tpl-matriz-margin-left');
  if (elMLeft && elMLeft.value !== '') {
    let raw = parseFloat(String(elMLeft.value).replace(',', '.'));
    if (!isNaN(raw)) m.margin_left = raw > 5 ? raw / 10 : raw;
  }
  const elGapX = document.getElementById('tpl-matriz-gap-x');
  if (elGapX && elGapX.value !== '') {
    let raw = parseFloat(String(elGapX.value).replace(',', '.'));
    if (!isNaN(raw)) m.gap_x = raw > 3 ? raw / 10 : raw;
  }
  const elGapY = document.getElementById('tpl-matriz-gap-y');
  if (elGapY && elGapY.value !== '') {
    let raw = parseFloat(String(elGapY.value).replace(',', '.'));
    if (!isNaN(raw)) m.gap_y = raw > 3 ? raw / 10 : raw;
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

  renderMatrizA4Tab1();
}

// Renderizado de Pliego A4 Vectorial en Pestaña 1 (Estructura)
// Función de solo lectura sobre currentTemplate.matriz_a4 (no muta ni sobreescribe el estado)
function renderMatrizA4Tab1() {
  const sheet = document.getElementById('tab1-a4-preview-sheet');
  if (!sheet) return;
  if (!currentTemplate) {
    sheet.innerHTML = '';
    return;
  }

  if (typeof _normalizarPlantilla === 'function') {
    _normalizarPlantilla(currentTemplate);
  }
  const m = currentTemplate.matriz_a4 || {};

  const cols = m.columnas || 2;
  const rows = m.filas || 4;
  let mTop = m.margin_top ?? 1.0;
  let mLeft = m.margin_left ?? 1.0;
  let gapX = m.gap_x ?? 0.0;
  let gapY = m.gap_y ?? 0.0;
  if (mTop > 5) mTop /= 10;
  if (mLeft > 5) mLeft /= 10;
  if (gapX > 3) gapX /= 10;
  if (gapY > 3) gapY /= 10;

  const corteTipo = m.corte_tipo || 'solid';
  const corteGrosor = m.corte_grosor || 1;
  const corteColor = m.corte_color || '#94a3b8';
  const corteHActivo = m.corte_h_activo !== false;
  const corteHModo = m.corte_h_modo || 'pegadas';
  const corteVActivo = m.corte_v_activo !== false;
  const corteVModo = m.corte_v_modo || 'pegadas';

  let labelW_cm = currentTemplate.ancho || 10.0;
  let labelH_cm = currentTemplate.alto || 5.0;
  if (labelW_cm > 30) labelW_cm /= 10;
  if (labelH_cm > 30) labelH_cm /= 10;

  const totalLabels = cols * rows;

  const isLandscape = m.hoja_orientacion === 'horizontal' || m.hoja_orientacion === 'landscape';
  const sheetW_cm = isLandscape ? 29.7 : 21.0;
  const sheetH_cm = isLandscape ? 21.0 : 29.7;

  const a4Area = sheetW_cm * sheetH_cm;
  const usedArea = totalLabels * labelW_cm * labelH_cm;
  const efficiencyPct = Math.min(100, Math.max(0, (usedArea / a4Area) * 100)).toFixed(1);
  const wastePct = Math.max(0, 100 - parseFloat(efficiencyPct)).toFixed(1);

  const bCount = document.getElementById('tab1-badge-count');
  const bEff = document.getElementById('tab1-badge-efficiency');
  const bWaste = document.getElementById('tab1-badge-waste');
  const sheetDimLabel = document.getElementById('tab1-sheet-dimension-label');

  if (bCount) bCount.textContent = `${totalLabels} etiquetas / pliego`;
  if (bEff) bEff.textContent = `Aprovechamiento: ${efficiencyPct}%`;
  if (bWaste) bWaste.textContent = `Desperdicio: ${wastePct}%`;
  if (sheetDimLabel) sheetDimLabel.textContent = `${sheetW_cm.toFixed(1)} x ${sheetH_cm.toFixed(1)} cm (${isLandscape ? 'Horizontal' : 'Vertical'})`;

  let baseSheetW, baseSheetH, scale;
  if (isLandscape) {
    baseSheetW = TAB1_BASE_SHEET_HEIGHT;
    baseSheetH = TAB1_BASE_SHEET_HEIGHT * (21.0 / 29.7);
    scale = baseSheetW / 29.7;
  } else {
    baseSheetH = TAB1_BASE_SHEET_HEIGHT;
    baseSheetW = TAB1_BASE_SHEET_HEIGHT * (21.0 / 29.7);
    scale = baseSheetW / 21.0;
  }

  sheet.style.width = `${baseSheetW}px`;
  sheet.style.height = `${baseSheetH}px`;
  applyTab1ZoomTransform();
  updateTab1ZoomDisplay();
  sheet.innerHTML = '';

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

      const activeSlotIdx = currentTemplate.slot_activo || 0;
      const activeSlot = (currentTemplate.slots_fondo || [])[activeSlotIdx >= 0 && activeSlotIdx < 3 ? activeSlotIdx : -1];
      if (activeSlot && activeSlot.url) {
        labelDiv.style.backgroundImage = `url('${activeSlot.url}')`;
        labelDiv.style.backgroundSize = '100% 100%';
        labelDiv.style.backgroundPosition = 'center';
      }

      labelDiv.textContent = `#${r * cols + c + 1}`;
      sheet.appendChild(labelDiv);
    }
  }

  renderCutLinesHelper(sheet, {
    cols, rows, mTop, mLeft, gapX, gapY, labelW_cm, labelH_cm, scale,
    corteTipo, corteGrosor, corteColor,
    corteHActivo, corteHModo, corteVActivo, corteVModo
  });
}

// Exponer funciones globalmente en window
window.initTab1BaseSize = initTab1BaseSize;
window.adjustTab1Zoom = adjustTab1Zoom;
window.resetTab1Zoom = resetTab1Zoom;
window.updateTab1ZoomDisplay = updateTab1ZoomDisplay;
window.updateLabelDimensions = updateLabelDimensions;
window.updateTemplateEtiquetaTamano = updateTemplateEtiquetaTamano;
window.saveMatrizA4Config = saveMatrizA4Config;
window.toggleAllTab1Accordions = toggleAllTab1Accordions;
window.renderCutLinesHelper = renderCutLinesHelper;
window.renderMatrizA4Tab1 = renderMatrizA4Tab1;
window.updateMatrizA4FromInputs = updateMatrizA4FromInputs;

