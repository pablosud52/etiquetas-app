// =========================================================================
// MÓDULO 2 - EDITOR DE PLANTILLAS: DISEÑO VISUAL Y MAPEO DE CAMPOS
// Archivo: public/js/editor-diseno.js
// Responsabilidad: Pestaña 2 - Lienzo interactivo 2D, Drag & Drop,
//                  Maquetación de campos, Fuentes, Slots de fondo,
//                  Punto de anclaje de alineación, Acordeón exclusivo auto-collapse,
//                  Formato decimal y Tabla de datos de prueba.
// =========================================================================

if (typeof normalizeSearchText !== 'function') {
  window.normalizeSearchText = function(str) {
    if (!str) return '';
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  };
}

if (typeof matchesTemplateSize !== 'function') {
  window.matchesTemplateSize = function(productTamano, templateTamano) {
    if (!templateTamano) return true;
    const tSize = templateTamano.toLowerCase().trim();
    if (!tSize || tSize === 'personalizado' || tSize === '-- todos los tamaños --') return true;
    const pSize = (productTamano || '').toLowerCase().trim();
    if (tSize === '__empty__' || tSize === '(vacíos)') return pSize === '';
    return pSize === tSize || pSize.includes(tSize) || tSize.includes(pSize);
  };
}

// ACORDEÓN DE CONTROLES: MODO EXCLUSIVO (AUTO-COLLAPSE)
function toggleAccordion(id) {
  const content = document.getElementById(`content-${id}`);
  const arrow = document.getElementById(`arrow-${id}`);
  if (!content) return;

  const isHidden = content.classList.contains('hidden');
  if (isHidden) {
    collapseAllAccordions();
    content.classList.remove('hidden');
    if (arrow) arrow.style.transform = 'rotate(180deg)';

    if (id === 'sec-selector-prop' && typeof renderPropertySwitches === 'function') {
      renderPropertySwitches();
    }
    
    if (id.startsWith('sec-')) {
      const fieldId = id.replace('sec-', '');
      if (FIELD_DEFINITIONS && FIELD_DEFINITIONS.find(f => f.id === fieldId)) {
        selectCanvasElement(fieldId, true);
      }
    }
  } else {
    content.classList.add('hidden');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}

function collapseAllAccordions() {
  document.querySelectorAll('.accordion-content').forEach(c => c.classList.add('hidden'));
  document.querySelectorAll('[id^="arrow-"]').forEach(a => a.style.transform = 'rotate(0deg)');
}

function openAccordionForElement(fieldId, skipScroll = false) {
  collapseAllAccordions();
  const content = document.getElementById(`content-sec-${fieldId}`);
  const arrow = document.getElementById(`arrow-sec-${fieldId}`);
  if (content) {
    content.classList.remove('hidden');
    if (arrow) arrow.style.transform = 'rotate(180deg)';
    if (!skipScroll) {
      setTimeout(() => {
        content.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }
}

// SLOTS DE IMAGEN DE FONDO
function updateBgSlotsUI() {
  if (!currentTemplate.slots_fondo) {
    currentTemplate.slots_fondo = [{ id: 0, url: '', nombre: '' }, { id: 1, url: '', nombre: '' }, { id: 2, url: '', nombre: '' }];
  }

  const activeIdx = currentTemplate.slot_activo !== undefined ? currentTemplate.slot_activo : 0;

  for (let i = 0; i < 3; i++) {
    const slot = currentTemplate.slots_fondo[i] || { id: i, url: '', nombre: '' };
    const card = document.getElementById(`bg-slot-card-${i}`);
    const thumb = document.getElementById(`bg-slot-thumb-${i}`);

    if (card && thumb) {
      if (i === activeIdx) {
        card.className = 'bg-slate-900 border-2 border-emerald-500 rounded-xl p-2 flex flex-col items-center justify-between text-center relative cursor-pointer shadow-lg shadow-emerald-500/10 min-h-[120px]';
      } else {
        card.className = 'bg-slate-900 border-2 border-slate-700/60 hover:border-slate-500 rounded-xl p-2 flex flex-col items-center justify-between text-center relative cursor-pointer min-h-[120px]';
      }

      if (slot.url) {
        thumb.style.backgroundImage = `url('${slot.url}')`;
        thumb.innerHTML = '';
      } else {
        thumb.style.backgroundImage = 'none';
        thumb.innerHTML = '<span class="text-[10px] text-slate-500">Vacío</span>';
      }
    }
  }

  const info = document.getElementById('active-bg-info');
  if (info) {
    info.textContent = activeIdx >= 0 ? `Ranura activa: Slot ${activeIdx + 1}` : 'Sin imagen de fondo';
  }
}

function selectActiveBgSlot(index) {
  pushHistoryState();
  if (currentTemplate.slot_activo === index) {
    currentTemplate.slot_activo = -1;
  } else {
    currentTemplate.slot_activo = index;
  }
  updateBgSlotsUI();
  renderCanvas();
}

async function handleUploadBgSlot(index, event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('bgFile', file);

  try {
    const res = await fetch('/api/templates/background-upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Error al subir imagen');

    pushHistoryState();
    currentTemplate.slots_fondo[index] = {
      id: index,
      url: data.url,
      nombre: file.name
    };
    currentTemplate.slot_activo = index;

    updateBgSlotsUI();
    renderCanvas();
  } catch (err) {
    const reader = new FileReader();
    reader.onload = (e) => {
      pushHistoryState();
      currentTemplate.slots_fondo[index] = {
        id: index,
        url: e.target.result,
        nombre: file.name
      };
      currentTemplate.slot_activo = index;
      updateBgSlotsUI();
      renderCanvas();
    };
    reader.readAsDataURL(file);
  }
}

function deleteBgSlot(index) {
  pushHistoryState();
  currentTemplate.slots_fondo[index] = { id: index, url: '', nombre: '' };
  if (currentTemplate.slot_activo === index) {
    currentTemplate.slot_activo = -1;
  }
  updateBgSlotsUI();
  renderCanvas();
}

function downloadBgSlot(index) {
  const slot = (currentTemplate.slots_fondo || [])[index];
  if (!slot || !slot.url) {
    alert(`No hay ninguna imagen cargada en la ranura (Slot ${index + 1}).`);
    return;
  }

  const a = document.createElement('a');
  a.href = slot.url;
  a.download = slot.nombre || `fondo_slot_${index + 1}.png`;
  a.click();
}

function downloadActiveBg() {
  const activeIdx = currentTemplate.slot_activo !== undefined ? currentTemplate.slot_activo : 0;
  if (activeIdx < 0) {
    alert('No hay ninguna ranura de fondo seleccionada actualmente.');
    return;
  }
  downloadBgSlot(activeIdx);
}

// SELECTOR DE PROPIEDADES (HABILITADOR)
function renderPropertySwitches() {
  const container = document.getElementById('props-switches-container');
  if (!container) return;

  // Guard defensivo: normalizar campos_habilitados si es necesario
  if (!Array.isArray(currentTemplate.campos_habilitados)) {
    if (typeof currentTemplate.campos_habilitados === 'string') {
      try { currentTemplate.campos_habilitados = JSON.parse(currentTemplate.campos_habilitados); } catch (_) {}
    }
    if (!Array.isArray(currentTemplate.campos_habilitados)) {
      currentTemplate.campos_habilitados = ['title', 'spec_1', 'moneda', 'publico_entero', 'publico_decimal', 'cod_1'];
    }
  }

  container.innerHTML = '';

  FIELD_DEFINITIONS.forEach(f => {
    const isEnabled = currentTemplate.campos_habilitados.includes(f.id);

    const div = document.createElement('div');
    div.className = `px-3 py-2.5 rounded-xl border flex items-center justify-between transition-all ${isEnabled ? 'bg-slate-900/90 border-slate-700/80 shadow-sm' : 'bg-slate-900/40 border-slate-800/60 opacity-60'}`;
    
    div.innerHTML = `
      <span class="text-xs font-semibold text-slate-200 truncate mr-2">${f.label}</span>
      <label class="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" class="sr-only peer" ${isEnabled ? 'checked' : ''} onchange="toggleFieldProperty('${f.id}', this.checked)">
        <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    `;
    container.appendChild(div);
  });
}

function toggleFieldProperty(fieldId, isChecked) {
  pushHistoryState();

  if (!Array.isArray(currentTemplate.campos_habilitados)) {
    currentTemplate.campos_habilitados = [];
  }

  if (isChecked) {
    if (!currentTemplate.campos_habilitados.includes(fieldId)) {
      currentTemplate.campos_habilitados.push(fieldId);
    }
  } else {
    currentTemplate.campos_habilitados = currentTemplate.campos_habilitados.filter(id => id !== fieldId);
  }

  if (currentTemplate.elementos && currentTemplate.elementos[fieldId]) {
    currentTemplate.elementos[fieldId].habilitado = isChecked;
  }

  renderPropertySwitches();
  renderAllAccordionSections();
  renderCanvas();
}


// ACORDEÓN DE CONFIGURACIÓN DE PROPIEDADES ACTIVAS
function renderAllAccordionSections() {
  const container = document.getElementById('dynamic-property-accordions');
  if (!container) return;

  container.innerHTML = '';

  FIELD_DEFINITIONS.forEach((f, idx) => {
    if (!currentTemplate.campos_habilitados.includes(f.id)) return;

    const elem = currentTemplate.elementos[f.id] || {};

    const secDiv = document.createElement('div');
    secDiv.className = 'accordion-item rounded-xl bg-slate-900/40 border border-slate-700/40 overflow-hidden w-full';
    secDiv.id = `sec-wrapper-${f.id}`;

    const fontOptions = [...SYSTEM_FONTS, ...customInstalledFonts.map(cf => cf.nombre_familia)];
    const fontOptionsHtml = fontOptions.map(font => 
      `<option value="${font}" ${elem.fuente === font ? 'selected' : ''}>${font}</option>`
    ).join('');

    secDiv.innerHTML = `
      <button onclick="toggleAccordion('sec-${f.id}')" class="w-full p-2.5 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors cursor-pointer">
        <span class="text-xs font-bold text-slate-200 flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          ${f.label}
        </span>
        <svg id="arrow-sec-${f.id}" class="w-4 h-4 text-slate-400 transform transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      <div id="content-sec-${f.id}" class="accordion-content p-3 space-y-3 pt-0 border-t border-slate-700/30 text-xs hidden">
        <!-- Tipografía y Tamaño -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Fuente</label>
            <select onchange="updateElementProp('${f.id}', 'fuente', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
              ${fontOptionsHtml}
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Tamaño (pt)</label>
            <input type="number" value="${elem.tamano || 16}" min="6" max="150" oninput="updateElementProp('${f.id}', 'tamano', parseFloat(this.value))" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
          </div>
        </div>

        <!-- Color y Espaciado de Letras Decimal -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Color de Texto</label>
            <div class="flex items-center gap-1.5">
              <input type="color" value="${elem.color || '#ffffff'}" oninput="updateElementProp('${f.id}', 'color', this.value)" class="w-7 h-7 bg-slate-900 border border-slate-700 rounded cursor-pointer p-0.5">
              <input type="text" value="${elem.color || '#ffffff'}" onchange="updateElementProp('${f.id}', 'color', this.value)" class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono uppercase">
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Espaciado (Letter-Spacing px)</label>
            <input type="number" value="${elem.espaciado !== undefined ? elem.espaciado : 0}" min="-10.0" max="50.0" step="0.1" oninput="updateElementProp('${f.id}', 'espaciado', parseFloat(this.value))" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono">
          </div>
        </div>

        <!-- Borde de Texto (Stroke Exterior Puro) -->
        <div class="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700/50 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">Borde de Texto (Stroke)</span>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" ${elem.stroke_activo ? 'checked' : ''} onchange="updateElementProp('${f.id}', 'stroke_activo', this.checked)" class="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0">
              <span class="text-[10px] text-slate-400">Activar</span>
            </label>
          </div>
          <div class="grid grid-cols-2 gap-2 ${elem.stroke_activo ? '' : 'opacity-40 pointer-events-none'}">
            <div>
              <label class="block text-[10px] text-slate-400 mb-0.5">Color Borde</label>
              <input type="color" value="${elem.stroke_color || '#000000'}" oninput="updateElementProp('${f.id}', 'stroke_color', this.value)" class="w-full h-7 bg-slate-900 border border-slate-700 rounded cursor-pointer p-0.5">
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 mb-0.5">Grosor (px)</label>
              <input type="number" value="${elem.stroke_width !== undefined ? elem.stroke_width : 1.0}" min="0.1" max="20.0" step="0.1" oninput="updateElementProp('${f.id}', 'stroke_width', parseFloat(this.value))" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono">
            </div>
          </div>
        </div>

        <!-- Coordenadas X e Y Decimales -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Posición X (%)</label>
            <input type="number" id="input-pos-x-${f.id}" value="${Number(elem.x || 0).toFixed(1)}" min="0" max="100" step="0.1" oninput="updateElementProp('${f.id}', 'x', parseFloat(this.value))" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono">
          </div>
          <div>
            <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Posición Y (%)</label>
            <input type="number" id="input-pos-y-${f.id}" value="${Number(elem.y || 0).toFixed(1)}" min="0" max="100" step="0.1" oninput="updateElementProp('${f.id}', 'y', parseFloat(this.value))" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono">
          </div>
        </div>

        <!-- Estilos Adicionales: Negrita, Cursiva, Alineación con Estado Visual Activo -->
        <div class="flex items-center justify-between pt-1">
          <div class="flex items-center gap-1">
            <button onclick="updateElementProp('${f.id}', 'bold', !${!!elem.bold})" class="px-3 py-1 rounded text-xs font-bold border cursor-pointer transition-colors ${elem.bold ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}">B</button>
            <button onclick="updateElementProp('${f.id}', 'italic', !${!!elem.italic})" class="px-3 py-1 rounded text-xs italic border cursor-pointer transition-colors ${elem.italic ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}">I</button>
          </div>
          <div class="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-700">
            <button onclick="updateElementProp('${f.id}', 'alineacion', 'left')" class="p-1.5 rounded cursor-pointer transition-colors ${elem.alineacion === 'left' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}" title="Izquierda">⯇</button>
            <button onclick="updateElementProp('${f.id}', 'alineacion', 'center')" class="p-1.5 rounded cursor-pointer transition-colors ${elem.alineacion === 'center' || !elem.alineacion ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}" title="Centro">☰</button>
            <button onclick="updateElementProp('${f.id}', 'alineacion', 'right')" class="p-1.5 rounded cursor-pointer transition-colors ${elem.alineacion === 'right' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}" title="Derecha">⯈</button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(secDiv);
  });
}

function updateElementProp(fieldId, propKey, value) {
  pushHistoryState();
  if (!currentTemplate.elementos[fieldId]) return;
  currentTemplate.elementos[fieldId][propKey] = value;

  if (['stroke_activo', 'bold', 'italic', 'alineacion'].includes(propKey)) {
    renderAllAccordionSections();
    openAccordionForElement(fieldId);
  }

  renderCanvas();
}

// RENDERIZADO DEL LIENZO INTERACTIVO Y DRAG & DROP
function renderCanvas() {
  const canvas = document.getElementById('editor-canvas');
  const layer = document.getElementById('canvas-elements-layer');
  const viewport = document.getElementById('canvas-viewport');
  if (!canvas || !layer) return;

  const basePxPerCm = 37.8;
  let anchoCm = currentTemplate.ancho || 10.0;
  let altoCm = currentTemplate.alto || 5.0;
  if (anchoCm > 30) anchoCm /= 10;
  if (altoCm > 30) altoCm /= 10;

  const rawWidth = anchoCm * basePxPerCm;
  const rawHeight = altoCm * basePxPerCm;

  let autoFitScale = 1.0;
  if (viewport) {
    const maxW = Math.max(250, viewport.clientWidth - 80);
    const maxH = Math.max(250, viewport.clientHeight - 80);
    const scaleW = maxW / rawWidth;
    const scaleH = maxH / rawHeight;
    autoFitScale = Math.min(1.0, scaleW, scaleH);
    if (autoFitScale < 0.05) autoFitScale = 0.05;
  }

  const effectiveZoom = currentZoom * autoFitScale * 1.6;

  canvas.style.width = `${rawWidth * effectiveZoom}px`;
  canvas.style.height = `${rawHeight * effectiveZoom}px`;

  const activeSlotIdx = currentTemplate.slot_activo !== undefined ? currentTemplate.slot_activo : 0;
  const activeSlot = activeSlotIdx >= 0 ? (currentTemplate.slots_fondo || [])[activeSlotIdx] : null;

  // --- Fondo / imagen de slot ---
  if (activeSlot && activeSlot.url) {
    canvas.style.backgroundImage = `url('${activeSlot.url}')`;
    canvas.style.backgroundSize = `100% 100%`;
    canvas.style.backgroundPosition = `center`;
  } else {
    canvas.style.backgroundImage = 'none';
  }

  // --- Capa de cuadrícula guía (overlay independiente) ---
  const gridOverlay = document.getElementById('canvas-grid-overlay');
  if (gridOverlay) {
    if (_gridActive) {
      const gridPx = 0.5 * basePxPerCm * effectiveZoom; // 5mm en px
      // Líneas oscuras semitransparentes: visibles sobre fondos claros y oscuros
      gridOverlay.style.backgroundImage =
        `linear-gradient(to right, rgba(80,120,200,0.25) 1px, transparent 1px),` +
        `linear-gradient(to bottom, rgba(80,120,200,0.25) 1px, transparent 1px)`;
      gridOverlay.style.backgroundSize = `${gridPx}px ${gridPx}px`;
      gridOverlay.style.backgroundPosition = `0 0`;
      gridOverlay.classList.remove('hidden');
    } else {
      gridOverlay.classList.add('hidden');
      gridOverlay.style.backgroundImage = 'none';
    }
  }


  canvas.onclick = (e) => {
    if (e.target === canvas || e.target === layer) {
      selectCanvasElement(null);
    }
  };

  layer.innerHTML = '';

  FIELD_DEFINITIONS.forEach(f => {
    if (!currentTemplate.campos_habilitados.includes(f.id)) return;
    const elem = currentTemplate.elementos[f.id];
    if (!elem) return;

    const elDiv = document.createElement('div');
    elDiv.id = `canvas-elem-${f.id}`;
    elDiv.dataset.fieldId = f.id;
    
    const isSelected = selectedElementId === f.id;
    elDiv.className = `absolute cursor-move select-none transition-shadow ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900 bg-blue-500/10' : 'hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-400'}`;
    
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

    // Tipografía y Estilos
    elDiv.style.fontFamily = `'${elem.fuente}', sans-serif`;
    elDiv.style.fontSize = `${(elem.tamano || 16) * effectiveZoom}px`;
    elDiv.style.lineHeight = '1.15';
    elDiv.style.whiteSpace = 'nowrap';
    elDiv.style.color = elem.color || '#ffffff';
    elDiv.style.fontWeight = elem.bold ? 'bold' : 'normal';
    elDiv.style.fontStyle = elem.italic ? 'italic' : 'normal';
    elDiv.style.letterSpacing = `${(elem.espaciado || 0) * effectiveZoom}px`;

    // Stroke / Borde de Texto (Exterior Puro via paint-order y perimetro 8-puntos)
    if (elem.stroke_activo) {
      const strokePx = (elem.stroke_width !== undefined ? elem.stroke_width : 1.0) * effectiveZoom;
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

    elDiv.textContent = getElementDisplayValue(f.id);

    attachDragEvents(elDiv, f.id, canvas);

    layer.appendChild(elDiv);
  });
}

function activeIdxSafe(idx) {
  return (idx >= 0 && idx < 3) ? idx : -1;
}

function getElementDisplayValue(fieldId) {
  const p = selectedTestProduct;
  const elem = currentTemplate.elementos[fieldId] || {};

  if (!p) {
    return elem.texto_muestra || FIELD_DEFINITIONS.find(f => f.id === fieldId)?.defaultVal || fieldId;
  }

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
    default: return elem.texto_muestra || fieldId;
  }
}

// DRAG & DROP FLUIDO Y PRECISO
function attachDragEvents(el, fieldId, canvas) {
  let isDragging = false;
  let startX = 0, startY = 0;
  let elemStartX = 0, elemStartY = 0;

  const onDragStart = (e) => {
    e.stopPropagation();
    pushHistoryState();

    selectCanvasElement(fieldId);
    isDragging = true;

    if (e.pointerId !== undefined && el.setPointerCapture) {
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    }

    startX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    startY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    const elem = currentTemplate.elementos[fieldId] || {};
    elemStartX = elem.x || 0;
    elemStartY = elem.y || 0;
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    const canvasRect = canvas.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    const deltaPercentX = (deltaX / canvasRect.width) * 100;
    const deltaPercentY = (deltaY / canvasRect.height) * 100;

    let newX = Math.max(0, Math.min(98, elemStartX + deltaPercentX));
    let newY = Math.max(0, Math.min(98, elemStartY + deltaPercentY));

    const chkSnap = document.getElementById('chk-snap');
    if (chkSnap && chkSnap.checked) {
      let anchoCm = currentTemplate.ancho || 10.0;
      let altoCm = currentTemplate.alto || 5.0;
      if (anchoCm > 30) anchoCm /= 10;
      if (altoCm > 30) altoCm /= 10;
      const snapStepX = (0.5 / anchoCm) * 100;
      const snapStepY = (0.5 / altoCm) * 100;
      newX = Math.round(newX / snapStepX) * snapStepX;
      newY = Math.round(newY / snapStepY) * snapStepY;
      
      newX = Math.max(0, Math.min(100 - snapStepX, newX)); 
      newY = Math.max(0, Math.min(100 - snapStepY, newY));
    }

    newX = parseFloat(newX.toFixed(1));
    newY = parseFloat(newY.toFixed(1));

    if (!currentTemplate.elementos[fieldId]) return;
    currentTemplate.elementos[fieldId].x = newX;
    currentTemplate.elementos[fieldId].y = newY;

    el.style.left = `${newX}%`;
    el.style.top = `${newY}%`;

    const inputX = document.getElementById(`input-pos-x-${fieldId}`);
    const inputY = document.getElementById(`input-pos-y-${fieldId}`);
    if (inputX) inputX.value = newX.toFixed(1);
    if (inputY) inputY.value = newY.toFixed(1);
  };

  const onDragEnd = (e) => {
    if (isDragging) {
      isDragging = false;
      if (e && e.pointerId !== undefined && el.releasePointerCapture) {
        try { el.releasePointerCapture(e.pointerId); } catch (err) {}
      }
    }
  };

  el.addEventListener('pointerdown', onDragStart);
  el.addEventListener('pointermove', onDragMove);
  el.addEventListener('pointerup', onDragEnd);
  el.addEventListener('pointercancel', onDragEnd);

  el.addEventListener('mousedown', onDragStart);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
}

function selectCanvasElement(fieldId, skipAccordionScroll = false) {
  selectedElementId = fieldId;

  if (!fieldId) {
    FIELD_DEFINITIONS.forEach(f => {
      const el = document.getElementById(`canvas-elem-${f.id}`);
      if (el) el.className = `absolute cursor-move select-none transition-shadow hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-400`;
    });
    const indicator = document.getElementById('selected-element-indicator');
    if (indicator) indicator.textContent = `Ningún elemento seleccionado`;
    collapseAllAccordions();
    return;
  }

  FIELD_DEFINITIONS.forEach(f => {
    const el = document.getElementById(`canvas-elem-${f.id}`);
    if (el) {
      if (f.id === fieldId) {
        el.className = `absolute cursor-move select-none transition-shadow ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900 bg-blue-500/10`;
      } else {
        el.className = `absolute cursor-move select-none transition-shadow hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-400`;
      }
    }
  });

  const indicator = document.getElementById('selected-element-indicator');
  const fieldDef = FIELD_DEFINITIONS.find(f => f.id === fieldId);
  if (indicator) {
    indicator.textContent = `Seleccionado: ${fieldDef ? fieldDef.label : fieldId}`;
  }

  if (!skipAccordionScroll) {
    openAccordionForElement(fieldId);
  }
}

// FUENTES DE TEXTO PERSONALIZADAS
function openFontModal() {
  const modal = document.getElementById('modal-fonts');
  if (modal) modal.classList.remove('hidden');
  renderInstalledFontsList();
}

function closeFontModal() {
  const modal = document.getElementById('modal-fonts');
  if (modal) modal.classList.add('hidden');
}

async function loadInstalledFonts() {
  try {
    const res = await fetch('/api/fonts');
    if (!res.ok) return;
    customInstalledFonts = await res.json();
    window.customInstalledFonts = customInstalledFonts;

    customInstalledFonts.forEach(cf => {
      try {
        const fontFace = new FontFace(cf.nombre_familia, `url('${cf.ruta}')`);
        fontFace.load().then(loaded => {
          document.fonts.add(loaded);
          if (typeof renderGeneradorPagePreview === 'function' && typeof currentModule !== 'undefined' && currentModule === 'generador') {
            renderGeneradorPagePreview();
          }
        }).catch(e => console.warn('Error cargando fontface:', cf.nombre_familia, e));
      } catch (e) {
        console.error('Error registrando fontface:', e);
      }
    });
  } catch (err) {
    console.error('Error al cargar fuentes:', err);
  }
}

function renderInstalledFontsList() {
  const list = document.getElementById('installed-fonts-list');
  if (!list) return;

  if (customInstalledFonts.length === 0) {
    list.innerHTML = '<p class="text-slate-500 text-center py-2">No hay fuentes personalizadas subidas aún.</p>';
    return;
  }

  list.innerHTML = '';
  customInstalledFonts.forEach(f => {
    const div = document.createElement('div');
    div.className = 'py-1.5 flex justify-between items-center';
    div.innerHTML = `
      <span style="font-family: '${f.nombre_familia}', sans-serif;">${f.nombre_familia}</span>
      <button onclick="deleteCustomFont(${f.id})" class="text-red-400 hover:text-red-300 text-[10px]">Eliminar</button>
    `;
    list.appendChild(div);
  });
}

// SUBIDA MÚLTIPLE DE FUENTES SIMULTÁNEA
async function handleFontUploadSubmit(e) {
  e.preventDefault();
  const fileInput = document.getElementById('font-file-input');
  const familyInput = document.getElementById('font-family-name');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;

  const files = Array.from(fileInput.files);
  const customName = (familyInput?.value || '').trim();
  const btn = document.getElementById('btn-submit-font');
  if (btn) btn.disabled = true;

  try {
    let countSuccess = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('fontFile', file);
      
      const fileNameNoExt = file.name.replace(/\.[^/.]+$/, '');
      const familyName = files.length === 1 && customName ? customName : (customName ? `${customName} (${fileNameNoExt})` : fileNameNoExt);
      formData.append('nombre_familia', familyName);

      const res = await fetch('/api/fonts/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) countSuccess++;
    }

    alert(`✅ ¡${countSuccess} fuente(s) instalada(s) con éxito!`);
    fileInput.value = '';
    if (familyInput) familyInput.value = '';

    await loadInstalledFonts();
    renderInstalledFontsList();
    renderAllAccordionSections();
    renderCanvas();
  } catch (err) {
    alert('Error al subir fuentes: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteCustomFont(id) {
  if (!confirm('¿Eliminar esta fuente personalizada?')) return;
  try {
    await fetch(`/api/fonts/${id}`, { method: 'DELETE' });
    await loadInstalledFonts();
    renderInstalledFontsList();
    renderAllAccordionSections();
    renderCanvas();
  } catch (err) {
    alert(err.message);
  }
}

// TABLA DE PRODUCTOS DE PRUEBA Y FILTRO DE TAMAÑO EN EXCEL
function populateEditorTamanoSelect() {
  const select = document.getElementById('editor-prod-tamano-select');
  if (!select) return;

  const hasEmpty = allEditorProducts.some(p => (p.etiqueta_tamano || '').trim() === '');
  const uniqueSizes = Array.from(new Set(
    allEditorProducts.map(p => (p.etiqueta_tamano || '').trim()).filter(Boolean)
  ));
  uniqueSizes.sort((a, b) => a.localeCompare(b));

  const activeSize = (currentTemplate.etiqueta_tamano || '').trim();
  // 'Personalizado' means no filter was saved, treat as 'todos'
  const savedSize = (activeSize && activeSize.toLowerCase() !== 'personalizado') ? activeSize : '';

  select.innerHTML = '<option value="">-- Todos los Tamaños --</option>';

  // Option for products with empty etiqueta_tamano
  if (hasEmpty) {
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '__empty__';
    emptyOpt.textContent = '(vacíos)';
    if (savedSize === '__empty__') emptyOpt.selected = true;
    select.appendChild(emptyOpt);
  }

  uniqueSizes.forEach(size => {
    const opt = document.createElement('option');
    opt.value = size;
    opt.textContent = size;
    if (savedSize && (savedSize.toLowerCase() === size.toLowerCase() || size.toLowerCase().includes(savedSize.toLowerCase()))) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function onEditorTamanoSelectChange(val) {
  pushHistoryState();
  currentTemplate.etiqueta_tamano = val || 'Personalizado';

  const inputTamano = document.getElementById('tpl-etiqueta-tamano');
  if (inputTamano) inputTamano.value = currentTemplate.etiqueta_tamano;

  filterEditorProductsTable();
}

async function loadEditorProductsTable() {
  const tbody = document.getElementById('editor-prod-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Error al cargar catálogo');

    allEditorProducts = await res.json();
    allEditorProducts.forEach(p => {
      p._searchIndex = normalizeSearchText([
        p.cod_1, p.cod_2, p.producto, p.title,
        p.spec_1, p.spec_2, p.spec_3, p.spec_4, p.spec_5,
        p.etiqueta_tamano
      ].filter(Boolean).join(' '));
    });

    populateEditorTamanoSelect();
    filterEditorProductsTable();
  } catch (err) {
    console.error(err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-red-400">Error al cargar productos</td></tr>';
  }
}

let editorSearchDebounceTimer = null;

// Evento oninput del buscador de productos en el Editor: control de botón [X] y debounce
function onEditorSearchInput() {
  const input = document.getElementById('editor-prod-search');
  const clearBtn = document.getElementById('editor-search-clear');
  const val = input ? input.value : '';

  if (clearBtn) {
    if (val.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  clearTimeout(editorSearchDebounceTimer);
  editorSearchDebounceTimer = setTimeout(() => {
    filterEditorProductsTable();
  }, 120);
}

// Limpiar campo de búsqueda de productos en el Editor de forma inmediata
function clearEditorSearch() {
  clearTimeout(editorSearchDebounceTimer);
  const input = document.getElementById('editor-prod-search');
  const clearBtn = document.getElementById('editor-search-clear');

  if (input) {
    input.value = '';
    input.focus();
  }
  if (clearBtn) {
    clearBtn.classList.add('hidden');
  }

  filterEditorProductsTable();
}

function filterEditorProductsTable() {
  const tbody = document.getElementById('editor-prod-tbody');
  if (!tbody) return;

  const rawQuery = (document.getElementById('editor-prod-search')?.value || '');
  const normalizedQuery = normalizeSearchText(rawQuery);
  const tokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

  const selectVal = (document.getElementById('editor-prod-tamano-select')?.value || '').trim();
  const filterBySize = document.getElementById('chk-filter-by-size')?.checked;
  const templateSize = (currentTemplate.etiqueta_tamano || '').trim();

  const targetSize = selectVal || (filterBySize ? templateSize : '');

  const filtered = allEditorProducts.filter(p => {
    // 1. Filtro secundario por tamaño seleccionado o de plantilla
    if (targetSize && targetSize.toLowerCase() !== 'personalizado') {
      if (!matchesTemplateSize(p.etiqueta_tamano, targetSize)) {
        return false;
      }
    }

    // 2. Coincidencia Total de Tokens sin Importar el Orden (Modo AND)
    if (tokens.length > 0) {
      const searchTarget = p._searchIndex || normalizeSearchText([
        p.cod_1, p.cod_2, p.producto, p.title,
        p.spec_1, p.spec_2, p.spec_3, p.spec_4, p.spec_5,
        p.etiqueta_tamano
      ].filter(Boolean).join(' '));

      const matchesAll = tokens.every(t => searchTarget.includes(t));
      if (!matchesAll) return false;
    }

    return true;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-slate-500">No se encontraron productos coincidentes</td></tr>';
    return;
  }

  filtered.forEach(p => {
    const tr = document.createElement('tr');
    const isSelected = selectedTestProduct && selectedTestProduct.id === p.id;
    tr.className = `hover:bg-slate-700/40 cursor-pointer transition-colors ${isSelected ? 'bg-blue-600/20 text-white font-semibold' : ''}`;
    
    tr.onclick = () => {
      selectedTestProduct = p;
      filterEditorProductsTable();
      renderCanvas();
    };

    const specs = [p.spec_1, p.spec_2, p.spec_3].filter(Boolean).join(', ');

    tr.innerHTML = `
      <td class="px-3 py-1.5 font-mono text-slate-300">${p.cod_1 || '-'}</td>
      <td class="px-3 py-1.5 font-mono text-slate-400">${p.cod_2 || '-'}</td>
      <td class="px-3 py-1.5 truncate max-w-[200px]">${p.title || '-'}</td>
      <td class="px-3 py-1.5 text-slate-400 truncate max-w-[140px]">${specs || '-'}</td>
      <td class="px-2 py-1.5 font-mono text-center">${p.moneda || '$'}</td>
      <td class="px-3 py-1.5 text-right font-bold text-emerald-400 font-mono">${Number(p.publico || 0).toFixed(2)}</td>
      <td class="px-3 py-1.5 text-right font-bold text-purple-400 font-mono">${Number(p.distribuidor || 0).toFixed(2)}</td>
      <td class="px-3 py-1.5 text-slate-400">${p.etiqueta_tamano || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// CONTROLES DE ZOOM DE LIENZO UNITARIO
function adjustZoom(delta) {
  currentZoom = Math.max(0.4, Math.min(2.5, currentZoom + delta));
  updateZoomDisplay();
  renderCanvas();
}

// Restablecer zoom exactamente a 100% (currentZoom = 1.0)
function resetZoomTo100() {
  currentZoom = 1.0;
  updateZoomDisplay();
  renderCanvas();
}

function resetZoom() {
  const viewport = document.getElementById('canvas-viewport');
  if (viewport) {
    const basePxPerCm = 37.8;
    let anchoCm = currentTemplate.ancho || 10.0;
    let altoCm = currentTemplate.alto || 5.0;
    if (anchoCm > 30) anchoCm /= 10;
    if (altoCm > 30) altoCm /= 10;

    const rawW = anchoCm * basePxPerCm;
    const rawH = altoCm * basePxPerCm;
    const availW = Math.max(100, viewport.clientWidth - 48);
    const availH = Math.max(100, viewport.clientHeight - 48);
    if (rawW > 0 && rawH > 0) {
      const zoomX = availW / rawW;
      const zoomY = availH / rawH;
      currentZoom = Math.max(0.3, Math.min(2.5, Math.min(zoomX, zoomY)));
    } else {
      currentZoom = 1.0;
    }
  } else {
    currentZoom = 1.0;
  }
  updateZoomDisplay();
  renderCanvas();
}

function updateZoomDisplay() {
  const display = document.getElementById('zoom-level-display');
  if (display) display.textContent = `${Math.round(currentZoom * 100)}%`;
}

// Exponer funciones globalmente en window
window.toggleAccordion = toggleAccordion;
window.collapseAllAccordions = collapseAllAccordions;
window.openAccordionForElement = openAccordionForElement;
window.updateBgSlotsUI = updateBgSlotsUI;
window.selectActiveBgSlot = selectActiveBgSlot;
window.handleUploadBgSlot = handleUploadBgSlot;
window.deleteBgSlot = deleteBgSlot;
window.downloadBgSlot = downloadBgSlot;
window.downloadActiveBg = downloadActiveBg;
window.renderPropertySwitches = renderPropertySwitches;
window.toggleFieldProperty = toggleFieldProperty;
window.renderAllAccordionSections = renderAllAccordionSections;
window.updateElementProp = updateElementProp;
window.renderCanvas = renderCanvas;
window.activeIdxSafe = activeIdxSafe;
window.getElementDisplayValue = getElementDisplayValue;
window.attachDragEvents = attachDragEvents;
window.selectCanvasElement = selectCanvasElement;
window.openFontModal = openFontModal;
window.closeFontModal = closeFontModal;
window.loadInstalledFonts = loadInstalledFonts;
window.renderInstalledFontsList = renderInstalledFontsList;
window.handleFontUploadSubmit = handleFontUploadSubmit;
window.deleteCustomFont = deleteCustomFont;
window.populateEditorTamanoSelect = populateEditorTamanoSelect;
window.onEditorTamanoSelectChange = onEditorTamanoSelectChange;
window.loadEditorProductsTable = loadEditorProductsTable;
window.filterEditorProductsTable = filterEditorProductsTable;
window.adjustZoom = adjustZoom;
window.resetZoom = resetZoom;
window.resetZoomTo100 = resetZoomTo100;
window.updateZoomDisplay = updateZoomDisplay;

// ============================================================
// TOGGLE CUADRÍCULA Y SNAP - Botones con estado visual activo
// ============================================================
var _gridActive = false;
var _snapActive = false;

function toggleGrid() {
  _gridActive = !_gridActive;
  const chkGrid = document.getElementById('chk-grid');
  if (chkGrid) chkGrid.checked = _gridActive;

  const btn = document.getElementById('btn-grid-toggle');
  if (btn) {
    if (_gridActive) {
      btn.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20';
    } else {
      btn.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500';
    }
  }
  renderCanvas();
}

function toggleSnap() {
  _snapActive = !_snapActive;
  const chkSnap = document.getElementById('chk-snap');
  if (chkSnap) chkSnap.checked = _snapActive;

  const btn = document.getElementById('btn-snap-toggle');
  if (btn) {
    if (_snapActive) {
      btn.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/20';
    } else {
      btn.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500';
    }
  }
  // No hay re-render necesario para snap; afecta al drag en tiempo real
}

window.toggleGrid = toggleGrid;
window.toggleSnap = toggleSnap;
