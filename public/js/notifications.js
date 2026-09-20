/**
 * Sistema Unificado de Notificaciones (Toasts) y Diálogos de Confirmación
 * Diseñado con Tailwind CSS y estética oscura (Slate) acorde a la aplicación.
 */

(function () {
  // Contenedor dinámico de toasts
  let toastContainer = null;

  function getToastContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  /**
   * Muestra una notificación tipo Toast
   * @param {string} rawMessage - Mensaje a mostrar (admite saltos de línea \n)
   * @param {'success'|'error'|'warning'|'info'} [type] - Tipo de notificación (se auto-detecta si no se especifica)
   * @param {number} [duration=3800] - Tiempo de visualización en milisegundos
   */
  function showToast(rawMessage, type = null, duration = 3800) {
    if (!rawMessage) return;
    let message = String(rawMessage).trim();

    // Detección automática del tipo si no se proporciona explícitamente
    if (!type) {
      if (message.startsWith('✅') || /éxito|guardad[ao]|correctamente|actualizad[ao]|instalad[ao]/i.test(message)) {
        type = 'success';
      } else if (message.startsWith('⚠️') || /atención|cuidado|advertencia/i.test(message)) {
        type = 'warning';
      } else if (/error|falló|fallo|no se pudo|inválid[ao]/i.test(message)) {
        type = 'error';
      } else {
        type = 'info';
      }
    }

    // Limpiar emojis iniciales redundantes para dejar un look profesional con el icono SVG
    message = message.replace(/^[✅⚠️❌ℹ️]\s*/, '');

    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto w-full bg-slate-800/95 border backdrop-blur-md text-slate-100 shadow-2xl rounded-xl p-3.5 relative overflow-hidden flex items-start gap-3 transition-all transform animate-toast-in';

    // Configuración según el tipo
    let borderClass = 'border-slate-700/80';
    let iconBgClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    let progressBgClass = 'bg-blue-500';
    let iconSvg = `
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    `;

    if (type === 'success') {
      borderClass = 'border-emerald-500/30';
      iconBgClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      progressBgClass = 'bg-emerald-500';
      iconSvg = `
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      `;
    } else if (type === 'error') {
      borderClass = 'border-red-500/30';
      iconBgClass = 'bg-red-500/10 text-red-400 border-red-500/20';
      progressBgClass = 'bg-red-500';
      iconSvg = `
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      `;
    } else if (type === 'warning') {
      borderClass = 'border-amber-500/30';
      iconBgClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      progressBgClass = 'bg-amber-500';
      iconSvg = `
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
      `;
    }

    toast.classList.add(...borderClass.split(' '));

    toast.innerHTML = `
      <div class="p-1.5 rounded-lg border flex-shrink-0 ${iconBgClass}">
        ${iconSvg}
      </div>
      <div class="flex-1 pr-2 min-w-0 pt-0.5">
        <p class="text-xs sm:text-sm font-medium text-slate-100 whitespace-pre-line leading-relaxed break-words">${escapeHTML(message)}</p>
      </div>
      <button type="button" class="text-slate-400 hover:text-white p-1 rounded-md transition-colors flex-shrink-0 cursor-pointer" title="Cerrar aviso">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
      <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-700/50 overflow-hidden">
        <div class="h-full ${progressBgClass}" style="animation: toastProgress ${duration}ms linear forwards;"></div>
      </div>
    `;

    // Cerrar al pulsar botón o al hacer clic
    const closeBtn = toast.querySelector('button');
    let isDismissed = false;

    const dismissToast = () => {
      if (isDismissed) return;
      isDismissed = true;
      toast.classList.remove('animate-toast-in');
      toast.classList.add('animate-toast-out');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 280);
    };

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast();
    });

    const timer = setTimeout(dismissToast, duration);

    // Pausar auto-descarte si el usuario pasa el mouse por encima
    toast.addEventListener('mouseenter', () => {
      clearTimeout(timer);
    });

    container.appendChild(toast);
    return toast;
  }

  /**
   * Modal de Confirmación Asíncrono
   * Devuelve una Promise que resuelve a `true` si el usuario confirma, o `false` si cancela.
   */
  function showConfirm({
    title = '¿Estás seguro?',
    message = '',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    type = 'danger' // 'danger' | 'primary' | 'warning'
  } = {}) {
    return new Promise((resolve) => {
      // Limpiar prefijo emoji si existe
      let cleanMsg = String(message).trim().replace(/^[⚠️ℹ️❓]\s*/, '');
      let cleanTitle = String(title).trim().replace(/^[⚠️ℹ️❓]\s*/, '');

      const backdrop = document.createElement('div');
      backdrop.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99998] flex items-center justify-center p-4 animate-modal-backdrop';

      let confirmBtnClass = 'bg-red-600 hover:bg-red-500 shadow-red-600/25';
      let iconColor = 'text-red-400 bg-red-500/10 border-red-500/20';
      let iconSvg = `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      `;

      if (type === 'warning') {
        confirmBtnClass = 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25';
        iconColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        iconSvg = `
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        `;
      } else if (type === 'primary') {
        confirmBtnClass = 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25';
        iconColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        iconSvg = `
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        `;
      }

      backdrop.innerHTML = `
        <div class="bg-slate-800/95 border border-slate-700/80 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-modal-card text-left">
          <div class="flex items-start gap-4">
            <div class="p-2.5 rounded-xl border flex-shrink-0 ${iconColor}">
              ${iconSvg}
            </div>
            <div class="space-y-1.5 flex-1 min-w-0">
              <h3 class="text-base font-semibold text-white tracking-tight">${escapeHTML(cleanTitle)}</h3>
              <p class="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed break-words">${escapeHTML(cleanMsg)}</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-700/60">
            <button type="button" id="modal-cancel-btn"
              class="px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-lg transition-colors cursor-pointer">
              ${escapeHTML(cancelText)}
            </button>
            <button type="button" id="modal-confirm-btn"
              class="px-4 py-2 text-xs sm:text-sm font-medium text-white ${confirmBtnClass} rounded-lg shadow-lg transition-all cursor-pointer">
              ${escapeHTML(confirmText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);

      const cancelBtn = backdrop.querySelector('#modal-cancel-btn');
      const confirmBtn = backdrop.querySelector('#modal-confirm-btn');

      // Auto-enfoque al botón de confirmación o cancelación según caso
      confirmBtn.focus();

      function closeDialog(result) {
        document.removeEventListener('keydown', handleKey);
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        resolve(result);
      }

      function handleKey(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeDialog(false);
        } else if (e.key === 'Enter' && (document.activeElement === confirmBtn || document.activeElement === cancelBtn)) {
          // El click nativo ya maneja la acción
        }
      }

      cancelBtn.addEventListener('click', () => closeDialog(false));
      confirmBtn.addEventListener('click', () => closeDialog(true));
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeDialog(false);
      });
      document.addEventListener('keydown', handleKey);
    });
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Interceptar window.alert nativo para que todas las llamadas actuales usen los Toasts
  const nativeAlert = window.alert;
  window.alert = function (message) {
    showToast(message);
  };

  // API pública en window y objeto toast
  window.showToast = showToast;
  window.showConfirm = showConfirm;
  window.toast = {
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    info: (msg, dur) => showToast(msg, 'info', dur)
  };
})();
