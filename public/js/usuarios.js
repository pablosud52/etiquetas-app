// =========================================================================
// MÓDULO 4: GESTIÓN DE USUARIOS Y PERMISOS POR MÓDULO
// Archivo: public/js/usuarios.js
// Responsabilidad: Control de usuarios, roles (Operador, Operador Editor,
//                  Operador Gestor, Administrador, Personalizado) y permisos granulares.
// =========================================================================

let allLoadedUsers = [];

function initUsuariosModule() {
  loadUsersTable();
}

/**
 * Calcula el rol y el badge correspondiente según la lista de módulos permitidos
 * @param {Array<string>} permisosList
 */
function calculateRoleInfo(permisosList) {
  const list = Array.isArray(permisosList) ? permisosList : [];
  const hasGen = list.includes('generador');
  const hasPlan = list.includes('plantillas');
  const hasDatos = list.includes('datos');
  const hasUsers = list.includes('usuarios');

  if (hasGen && hasPlan && hasDatos && hasUsers) {
    return {
      name: 'Administrador',
      badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"></span>
        Administrador
      </span>`
    };
  }
  if (hasGen && hasPlan && hasDatos && !hasUsers) {
    return {
      name: 'Operador Gestor',
      badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 shadow-[0_0_6px_rgba(251,191,36,0.8)]"></span>
        Operador Gestor
      </span>`
    };
  }
  if (hasGen && hasPlan && !hasDatos && !hasUsers) {
    return {
      name: 'Operador Editor',
      badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
        <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1.5 shadow-[0_0_6px_rgba(34,211,238,0.8)]"></span>
        Operador Editor
      </span>`
    };
  }
  if (hasGen && !hasPlan && !hasDatos && !hasUsers) {
    return {
      name: 'Operador',
      badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 shadow-[0_0_6px_rgba(96,165,250,0.8)]"></span>
        Operador
      </span>`
    };
  }
  return {
    name: 'Personalizado',
    badgeHtml: `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
      <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5"></span>
      Personalizado
    </span>`
  };
}

/**
 * Genera micro-badges visuales de los módulos activos del usuario
 */
function getModuleChipsHtml(permisosList) {
  const list = Array.isArray(permisosList) ? permisosList : [];
  const modules = [
    { key: 'generador', label: 'Gen', bg: 'bg-blue-900/40 text-blue-300 border-blue-500/30' },
    { key: 'plantillas', label: 'Plan', bg: 'bg-cyan-900/40 text-cyan-300 border-cyan-500/30' },
    { key: 'datos', label: 'Datos', bg: 'bg-amber-900/40 text-amber-300 border-amber-500/30' },
    { key: 'usuarios', label: 'Admin', bg: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30' }
  ];

  return modules.map(m => {
    const has = list.includes(m.key);
    if (has) {
      return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${m.bg}">${m.label}</span>`;
    }
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-800 text-slate-600 bg-slate-900/40 opacity-40">${m.label}</span>`;
  }).join(' ');
}

// Cargar lista de usuarios desde la API
async function loadUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  try {
    let res = await fetch('/api/users');
    if (!res.ok) {
      res = await fetch('/api/usuarios');
    }

    if (!res.ok) throw new Error('Error al conectar con la API de usuarios');

    const users = await res.json();
    allLoadedUsers = Array.isArray(users) ? users : [];
    tbody.innerHTML = '';

    if (!allLoadedUsers || allLoadedUsers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-500">No hay usuarios registrados</td></tr>';
      return;
    }

    allLoadedUsers.forEach(u => {
      const tr = document.createElement('tr');
      const isInactive = u.activo === 0;
      
      tr.className = `transition-colors border-b border-slate-700/40 ${isInactive ? 'bg-slate-900/40 text-slate-500 opacity-75' : 'hover:bg-slate-700/30'}`;

      const username = u.username || u.usuario || 'Sin nombre';
      const isMainAdmin = username.toLowerCase() === 'admin' || Number(u.id) === 1;
      
      let permisos = Array.isArray(u.permisos) ? u.permisos : [];
      if (permisos.length === 0 && isMainAdmin) {
        permisos = ['generador', 'plantillas', 'datos', 'usuarios'];
      }
      
      const roleInfo = calculateRoleInfo(permisos);
      const moduleChips = getModuleChipsHtml(permisos);
      const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : (u.created_at || u.fecha || '-');

      // Status badge (Activo / Inactivo)
      const statusBadge = isInactive
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            Inactivo
           </span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
            Activo
           </span>`;

      // Botón Deshabilitar / Habilitar
      const toggleActiveHtml = isMainAdmin
        ? ''
        : isInactive
          ? `<button onclick="toggleUserActive(${u.id}, '${username}', false)" class="px-2.5 py-1.5 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer">
              Habilitar
             </button>`
          : `<button onclick="toggleUserActive(${u.id}, '${username}', true)" class="px-2.5 py-1.5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 border border-amber-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer">
              Deshabilitar
             </button>`;

      // Botón de eliminar deshabilitado/oculto para 'admin'
      const deleteButtonHtml = isMainAdmin
        ? `<span class="px-2 py-1.5 text-xs text-slate-500 italic">Protegido</span>`
        : `<button onclick="deleteUser(${u.id}, '${username}')" class="px-2.5 py-1.5 bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer">
            Eliminar
           </button>`;

      const userDisplayClass = isInactive ? 'line-through text-slate-500' : 'font-semibold text-white';

      tr.innerHTML = `
        <td class="py-3.5 px-4 font-mono text-slate-400 text-xs">${u.id}</td>
        <td class="py-3.5 px-4 ${userDisplayClass}">${username}</td>
        <td class="py-3.5 px-4">${roleInfo.badgeHtml}</td>
        <td class="py-3.5 px-4"><div class="flex items-center gap-1">${moduleChips}</div></td>
        <td class="py-3.5 px-4">${statusBadge}</td>
        <td class="py-3.5 px-4 text-slate-400 text-xs">${dateStr}</td>
        <td class="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
          <button onclick="editUserById(${u.id})" class="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer">
            Editar
          </button>
          ${toggleActiveHtml}
          ${deleteButtonHtml}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-red-400">${err.message}</td></tr>`;
  }
}

/**
 * Obtiene los módulos seleccionados actualmente en el modal
 */
function getSelectedModalPermisos() {
  const list = [];
  ['generador', 'plantillas', 'datos', 'usuarios'].forEach(mod => {
    const chk = document.getElementById(`perm-${mod}`);
    if (chk && chk.checked) {
      list.push(mod);
    }
  });
  if (!list.includes('generador')) {
    list.unshift('generador');
  }
  return list;
}

/**
 * Actualiza en tiempo real el badge del rol en el encabezado del modal
 */
function updateModalRoleBadgePreview() {
  const previewEl = document.getElementById('modal-role-badge-preview');
  if (!previewEl) return;
  const list = getSelectedModalPermisos();
  const info = calculateRoleInfo(list);
  previewEl.innerHTML = info.badgeHtml;
}

/**
 * Evento disparado al cambiar un checkbox de módulo
 */
function onModulePermissionChange() {
  const chkGen = document.getElementById('perm-generador');
  if (chkGen && !chkGen.checked) {
    chkGen.checked = true; // Generador siempre es el módulo base
  }
  updateModalRoleBadgePreview();
}

/**
 * Aplica un preset rápido de rol en los checkboxes del modal
 */
function applyRolePreset(preset) {
  const chkGen = document.getElementById('perm-generador');
  const chkPlan = document.getElementById('perm-plantillas');
  const chkDatos = document.getElementById('perm-datos');
  const chkUsers = document.getElementById('perm-usuarios');

  if (chkGen) chkGen.checked = true;

  if (preset === 'operador') {
    if (chkPlan) chkPlan.checked = false;
    if (chkDatos) chkDatos.checked = false;
    if (chkUsers) chkUsers.checked = false;
  } else if (preset === 'editor') {
    if (chkPlan) chkPlan.checked = true;
    if (chkDatos) chkDatos.checked = false;
    if (chkUsers) chkUsers.checked = false;
  } else if (preset === 'gestor') {
    if (chkPlan) chkPlan.checked = true;
    if (chkDatos) chkDatos.checked = true;
    if (chkUsers) chkUsers.checked = false;
  } else if (preset === 'admin') {
    if (chkPlan) chkPlan.checked = true;
    if (chkDatos) chkDatos.checked = true;
    if (chkUsers) chkUsers.checked = true;
  }

  updateModalRoleBadgePreview();
}

// Abrir modal para NUEVO usuario
function openUserModal() {
  document.getElementById('modal-user-title').textContent = 'Nuevo Usuario';
  document.getElementById('modal-user-id').value = '';
  document.getElementById('modal-username').value = '';
  document.getElementById('modal-username').disabled = false;
  
  const passInput = document.getElementById('modal-password');
  const confirmInput = document.getElementById('modal-password-confirm');
  const btnUnlockPass = document.getElementById('btn-unlock-password');

  passInput.value = '';
  confirmInput.value = '';
  passInput.disabled = false;
  confirmInput.disabled = false;
  passInput.required = true;

  if (btnUnlockPass) btnUnlockPass.classList.add('hidden');

  // Habilitar checkboxes y aplicar preset 'operador' por defecto
  ['generador', 'plantillas', 'datos', 'usuarios'].forEach(mod => {
    const chk = document.getElementById(`perm-${mod}`);
    if (chk) chk.disabled = false;
  });

  applyRolePreset('operador');
  document.getElementById('user-modal').classList.remove('hidden');
}

// Abrir modal para EDITAR usuario buscando por ID
function editUserById(id) {
  const user = allLoadedUsers.find(u => Number(u.id) === Number(id));
  if (!user) return;
  editUser(user.id, user.username || user.usuario, user.rol, user.permisos);
}

// Abrir modal para EDITAR usuario (Modo Seguro de Cambio de Contraseña y Permisos)
function editUser(id, username, role, permisos) {
  const isMainAdmin = (username && username.toLowerCase() === 'admin') || Number(id) === 1;

  document.getElementById('modal-user-title').textContent = `Editar Usuario: ${username}`;
  document.getElementById('modal-user-id').value = id;
  
  const usernameInput = document.getElementById('modal-username');
  usernameInput.value = username;
  usernameInput.disabled = isMainAdmin; // No renombrar admin principal

  const passInput = document.getElementById('modal-password');
  const confirmInput = document.getElementById('modal-password-confirm');
  const btnUnlockPass = document.getElementById('btn-unlock-password');

  passInput.value = '';
  confirmInput.value = '';
  passInput.disabled = true; // Deshabilitado por defecto para evitar sobrescrituras accidentales
  confirmInput.disabled = true;
  passInput.required = false;

  if (btnUnlockPass) btnUnlockPass.classList.remove('hidden');

  // Configurar checkboxes según permisos actuales
  let permisosList = Array.isArray(permisos) ? permisos : [];
  if (isMainAdmin || permisosList.length === 0) {
    if (isMainAdmin || (role && role.toLowerCase().includes('admin'))) {
      permisosList = ['generador', 'plantillas', 'datos', 'usuarios'];
    } else if (role && role.toLowerCase().includes('gestor')) {
      permisosList = ['generador', 'plantillas', 'datos'];
    } else if (role && role.toLowerCase().includes('editor')) {
      permisosList = ['generador', 'plantillas'];
    } else {
      permisosList = ['generador'];
    }
  }

  ['generador', 'plantillas', 'datos', 'usuarios'].forEach(mod => {
    const chk = document.getElementById(`perm-${mod}`);
    if (chk) {
      chk.checked = permisosList.includes(mod);
      chk.disabled = isMainAdmin; // Proteger permisos del admin principal
    }
  });

  updateModalRoleBadgePreview();
  document.getElementById('user-modal').classList.remove('hidden');
}

// Habilitar campos de nueva contraseña en modo seguro
function unlockPasswordFields() {
  const passInput = document.getElementById('modal-password');
  const confirmInput = document.getElementById('modal-password-confirm');
  const btnUnlockPass = document.getElementById('btn-unlock-password');

  if (passInput) {
    passInput.disabled = false;
    passInput.focus();
  }
  if (confirmInput) confirmInput.disabled = false;
  if (btnUnlockPass) btnUnlockPass.classList.add('hidden');
}

function closeUserModal() {
  document.getElementById('user-modal').classList.add('hidden');
}

// Enviar formulario de usuario
async function handleUserSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('modal-user-id').value;
  const username = document.getElementById('modal-username').value.trim();
  const passInput = document.getElementById('modal-password');
  const confirmInput = document.getElementById('modal-password-confirm');
  const password = passInput && !passInput.disabled ? passInput.value : '';
  const passwordConfirm = confirmInput && !confirmInput.disabled ? confirmInput.value : '';

  if (!passInput.disabled && password) {
    if (password !== passwordConfirm) {
      alert('Las contraseñas no coinciden');
      return;
    }
  }

  const permisosList = getSelectedModalPermisos();
  const roleInfo = calculateRoleInfo(permisosList);

  const payload = { 
    usuario: username, 
    username: username, 
    rol: roleInfo.name, 
    role: roleInfo.name,
    permisos: permisosList
  };
  if (!passInput.disabled && password) payload.password = password;

  const method = id ? 'PUT' : 'POST';
  const primaryUrl = id ? `/api/users/${id}` : '/api/users';
  const fallbackUrl = id ? `/api/usuarios/${id}` : '/api/usuarios';

  try {
    let res = await fetch(primaryUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok && res.status === 404) {
      res = await fetch(fallbackUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Error al guardar el usuario');

    // Si el usuario editado es el mismo que está logueado, actualizar sus permisos en memoria
    if (currentUser && (currentUser.id == id || currentUser.usuario === username)) {
      currentUser.permisos = permisosList;
      currentUser.rol = roleInfo.name;
      currentUser.role = roleInfo.name;
      sessionStorage.setItem('user', JSON.stringify(currentUser));
      if (typeof showAppScreen === 'function') {
        showAppScreen();
      }
    }

    closeUserModal();
    loadUsersTable();
  } catch (err) {
    alert(err.message);
  }
}

// Habilitar o Inhabilitar usuario
async function toggleUserActive(id, username, actualmenteActivo) {
  const nuevoEstado = actualmenteActivo ? 0 : 1;
  const accionStr = actualmenteActivo ? 'deshabilitar' : 'habilitar';

  const confirmed = await showConfirm({
    title: actualmenteActivo ? 'Deshabilitar Usuario' : 'Habilitar Usuario',
    message: `¿Estás seguro de ${accionStr} el acceso al usuario "${username}"?`,
    confirmText: actualmenteActivo ? 'Deshabilitar' : 'Habilitar',
    cancelText: 'Cancelar',
    type: actualmenteActivo ? 'warning' : 'primary'
  });
  if (!confirmed) return;

  try {
    let res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: nuevoEstado })
    });

    if (!res.ok && res.status === 404) {
      res = await fetch(`/api/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nuevoEstado })
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || `Error al ${accionStr} usuario`);

    loadUsersTable();
  } catch (err) {
    alert(err.message);
  }
}

// Eliminar usuario
async function deleteUser(id, username) {
  if (username.toLowerCase() === 'admin' || Number(id) === 1) {
    alert('El usuario principal "admin" no puede ser eliminado.');
    return;
  }

  const confirmed = await showConfirm({
    title: 'Eliminar Usuario',
    message: `¿Estás seguro de eliminar permanentemente al usuario "${username}"?`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
  if (!confirmed) return;

  try {
    let res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status === 404) {
      res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Error al eliminar usuario');

    loadUsersTable();
  } catch (err) {
    alert(err.message);
  }
}

// Exponer en window para llamadas HTML
window.initUsuariosModule = initUsuariosModule;
window.loadUsersTable = loadUsersTable;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.editUser = editUser;
window.editUserById = editUserById;
window.unlockPasswordFields = unlockPasswordFields;
window.handleUserSubmit = handleUserSubmit;
window.toggleUserActive = toggleUserActive;
window.deleteUser = deleteUser;
window.applyRolePreset = applyRolePreset;
window.onModulePermissionChange = onModulePermissionChange;
window.updateModalRoleBadgePreview = updateModalRoleBadgePreview;