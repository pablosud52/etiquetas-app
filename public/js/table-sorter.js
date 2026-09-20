// =========================================================================
// COMPONENTE UNIVERSAL DE ORDENAMIENTO DE TABLAS (3 ESTADOS)
// Archivo: public/js/table-sorter.js
// Responsabilidad: Ciclo A-Z (▲), Z-A (▼) y Reset con flecha en color temático (text-blue-400)
// =========================================================================

class TableSortManager {
  /**
   * @param {Object} options
   * @param {string} options.containerSelector - Selector CSS del thead o contenedor de cabeceras
   * @param {Function} options.onSortChange - Callback que re-ejecuta el filtrado y renderizado
   */
  constructor(options = {}) {
    this.containerSelector = options.containerSelector || '';
    this.onSortChange = options.onSortChange || (() => {});
    this.currentCol = null;
    this.currentDir = 'none'; // 'none' | 'asc' | 'desc'
    this.currentType = 'string'; // 'string' | 'number'
  }

  /**
   * Alterna el ciclo de 3 estados para una columna: none -> asc (▲) -> desc (▼) -> none
   * @param {string} colKey Clave de la propiedad a ordenar
   * @param {'string'|'number'} [type='string'] Tipo de dato para orden numérico o alfanumérico
   */
  toggleSort(colKey, type = 'string') {
    if (this.currentCol !== colKey) {
      this.currentCol = colKey;
      this.currentDir = 'asc';
      this.currentType = type;
    } else if (this.currentDir === 'asc') {
      this.currentDir = 'desc';
    } else {
      this.currentCol = null;
      this.currentDir = 'none';
      this.currentType = 'string';
    }

    this.updateHeadersUI();
    if (typeof this.onSortChange === 'function') {
      this.onSortChange();
    }
  }

  /**
   * Resetea el ordenamiento a su estado original sin disparar callback
   */
  reset() {
    this.currentCol = null;
    this.currentDir = 'none';
    this.currentType = 'string';
    this.updateHeadersUI();
  }

  /**
   * Ordena un arreglo según la columna y dirección activa
   * @param {Array} items Lista de productos a ordenar
   * @param {Function} [customExtractor] Función opcional para extraer valores especiales (ej: specs compuestas)
   * @returns {Array} Nueva lista ordenada
   */
  sort(items, customExtractor) {
    if (!Array.isArray(items)) return [];

    // Estado 3: Reset al orden original
    if (!this.currentCol || this.currentDir === 'none') {
      return [...items].sort((a, b) => {
        const idxA = a._origIndex !== undefined ? a._origIndex : (a.id ?? 0);
        const idxB = b._origIndex !== undefined ? b._origIndex : (b.id ?? 0);
        return idxA - idxB;
      });
    }

    const col = this.currentCol;
    const dir = this.currentDir;
    const isNum = this.currentType === 'number';

    return [...items].sort((a, b) => {
      let valA, valB;
      if (typeof customExtractor === 'function') {
        valA = customExtractor(a, col);
        valB = customExtractor(b, col);
      } else {
        valA = a[col];
        valB = b[col];
      }

      if (isNum) {
        const numA = (valA != null && valA !== '') ? Number(valA) : -Infinity;
        const numB = (valB != null && valB !== '') ? Number(valB) : -Infinity;
        return dir === 'asc' ? numA - numB : numB - numA;
      }

      // Orden alfanumérico inteligente en español (considera números dentro de strings y tildes)
      const strA = String(valA ?? '').trim();
      const strB = String(valB ?? '').trim();
      const comp = strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? comp : -comp;
    });
  }

  /**
   * Actualiza los iconos y estilos visuales en las cabeceras TH de la tabla
   */
  updateHeadersUI() {
    if (!this.containerSelector) return;
    const container = document.querySelector(this.containerSelector);
    if (!container) return;

    const thList = container.querySelectorAll('th[data-sort-key]');
    thList.forEach(th => {
      const key = th.getAttribute('data-sort-key');
      const iconSpan = th.querySelector('.sort-icon');
      const isActive = this.currentCol === key && this.currentDir !== 'none';

      if (isActive) {
        th.classList.add('text-white', 'bg-slate-800/80');
        th.classList.remove('text-slate-400');
        if (iconSpan) {
          if (this.currentDir === 'asc') {
            // Flecha arriba ▲ en azul text-blue-400
            iconSpan.innerHTML = `<svg class="w-3.5 h-3.5 text-blue-400 font-bold drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7"/></svg>`;
          } else {
            // Flecha abajo ▼ en azul text-blue-400
            iconSpan.innerHTML = `<svg class="w-3.5 h-3.5 text-blue-400 font-bold drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>`;
          }
        }
      } else {
        th.classList.remove('text-white', 'bg-slate-800/80');
        th.classList.add('text-slate-400');
        if (iconSpan) {
          // Icono neutro sutil ⇅
          iconSpan.innerHTML = `<svg class="w-3 h-3 opacity-30 group-hover:opacity-75 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>`;
        }
      }
    });
  }
}

window.TableSortManager = TableSortManager;
