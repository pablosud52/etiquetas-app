let currentUser = null;
let currentModule = 'generador';

document.addEventListener('DOMContentLoaded', () => {
  // Verificar si hay una sesión activa en la pestaña actual (sessionStorage)
  const savedUser = sessionStorage.getItem('user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showAppScreen();
    } catch (e) {
      sessionStorage.removeItem('user');
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
});

// Muestra la pantalla de login y oculta el dashboard
function showLoginScreen() {
  const loginWrapper = document.getElementById('login-wrapper');
  const dashboardWrapper = document.getElementById('dashboard-wrapper');
  
  if (loginWrapper) loginWrapper.classList.remove('hidden');
  if (dashboardWrapper) dashboardWrapper.classList.add('hidden');
}

// Comprobar si el usuario actual tiene acceso a un módulo específico
function hasPermission(moduleName) {
  if (!currentUser) return false;
  const role = (currentUser.rol || currentUser.role || '').toLowerCase();
  if (role.includes('admin')) return true;

  const target = (moduleName === 'editor') ? 'plantillas' : moduleName;
  const permisos = currentUser.permisos;
  if (Array.isArray(permisos)) {
    return permisos.includes(target);
  }

  // Fallback por rol histórico
  if (role.includes('gestor')) {
    return ['generador', 'plantillas', 'datos'].includes(target);
  }
  if (role.includes('editor')) {
    return ['generador', 'plantillas'].includes(target);
  }
  return target === 'generador';
}
window.hasPermission = hasPermission;

// Muestra la pantalla principal y aplica permisos por rol
function showAppScreen() {
  const loginWrapper = document.getElementById('login-wrapper');
  const dashboardWrapper = document.getElementById('dashboard-wrapper');

  if (loginWrapper) loginWrapper.classList.add('hidden');
  if (dashboardWrapper) dashboardWrapper.classList.remove('hidden');

  if (!currentUser) return;

  // Mostrar únicamente el nombre limpio del usuario (sin sufijos como '(operador)')
  const userDisplay = document.getElementById('current-user-display');
  if (userDisplay) {
    const cleanName = currentUser.usuario || currentUser.username || 'Usuario';
    userDisplay.textContent = cleanName;
  }

  // Control dinámico de pestañas según los permisos asignados
  const tabsContainer = document.getElementById('tabs-container');
  let visibleTabsCount = 0;
  let firstPermittedModule = null;

  const tabModules = [
    { id: 'tab-generador', mod: 'generador' },
    { id: 'tab-plantillas', mod: 'plantillas' },
    { id: 'tab-datos', mod: 'datos' },
    { id: 'tab-usuarios', mod: 'usuarios' }
  ];

  tabModules.forEach(({ id, mod }) => {
    const tabEl = document.getElementById(id);
    if (tabEl) {
      if (hasPermission(mod)) {
        tabEl.classList.remove('hidden');
        visibleTabsCount++;
        if (!firstPermittedModule) firstPermittedModule = mod;
      } else {
        tabEl.classList.add('hidden');
      }
    }
  });

  if (tabsContainer) {
    // Si tiene acceso a más de 1 módulo, se muestra la barra para alternar entre ellos
    // Si solo tiene acceso a 1 módulo (ej: Operador solo a Generador), se oculta para vista limpia
    if (visibleTabsCount > 1) {
      tabsContainer.classList.remove('hidden');
    } else {
      tabsContainer.classList.add('hidden');
    }
  }

  // Cargar fuentes instaladas si existen
  if (typeof loadInstalledFonts === 'function') {
    loadInstalledFonts();
  }

  // Cargar componente inicial (prioriza generador si está disponible, o el primer módulo permitido)
  const initialModule = hasPermission('generador') ? 'generador' : (firstPermittedModule || 'generador');
  loadComponent(initialModule);
}

// Cerrar sesión
async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  } catch (e) {}

  sessionStorage.removeItem('user');
  localStorage.removeItem('user');
  currentUser = null;
  showLoginScreen();

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
}

// Carga modular dinámica de componentes en #main-content
async function loadComponent(name) {
  // Restricción de Seguridad: Validar que el usuario tenga permiso para el módulo solicitado
  if (!hasPermission(name)) {
    console.warn(`Acceso denegado a módulo '${name}'. Redirigiendo a módulo permitido.`);
    name = hasPermission('generador') ? 'generador' : 'generador';
  }

  // Mapear alias si es necesario (ej: 'plantillas' -> 'editor')
  const fileName = (name === 'plantillas') ? 'editor' : name;
  currentModule = name;

  const container = document.getElementById('main-content');
  if (!container) return;

  // Actualizar estilos activos e inactivos de las pestañas en el Navbar
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('bg-slate-700', 'text-white');
    tab.classList.add('text-slate-400', 'hover:text-slate-200');
  });

  const activeTabId = (name === 'editor' || name === 'plantillas') ? 'tab-plantillas' : `tab-${name}`;
  const activeTab = document.getElementById(activeTabId);
  if (activeTab) {
    activeTab.classList.remove('text-slate-400', 'hover:text-slate-200');
    activeTab.classList.add('bg-slate-700', 'text-white');
  }

  try {
    const res = await fetch(`components/${fileName}.html`);
    if (!res.ok) throw new Error(`No se pudo cargar el componente ${fileName}`);

    const html = await res.text();
    container.innerHTML = html;

    // Inicializar el módulo correspondiente
    if (fileName === 'generador' && typeof initGeneradorModule === 'function') {
      initGeneradorModule();
    } else if (fileName === 'editor' && typeof initEditorModule === 'function') {
      initEditorModule();
    } else if (fileName === 'datos' && typeof initDatosModule === 'function') {
      initDatosModule();
    } else if (fileName === 'usuarios') {
      if (typeof initUsuariosModule === 'function') initUsuariosModule();
      if (typeof initBackupModule === 'function') initBackupModule();
    }
  } catch (err) {
    console.error('Error al cargar módulo:', err);
    container.innerHTML = `<div class="p-6 bg-red-900/20 border border-red-500/40 rounded-xl text-red-300 text-sm">Error al cargar la sección: ${err.message}</div>`;
  }
}